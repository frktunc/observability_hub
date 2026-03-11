package app

import (
	"context"
	"encoding/json"
	"sync"

	"observability_hub/golang/internal/collector/config"
	"observability_hub/golang/internal/collector/consumer"
	"observability_hub/golang/internal/collector/metrics"
	"observability_hub/golang/internal/collector/storage"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

// App holds all the main dependencies of the applicationn
type App struct {
	Cfg           *config.Config
	Logger        *zap.Logger
	MetricsServer *metrics.Server
	RedisClient   *storage.RedisClient
	DBStorage     *storage.DBStorage
	ESStorage     *storage.ESStorage
	Consumer      *consumer.Consumer
}

// New initializes all dependencies and returns an App instance
func New(ctx context.Context, cfg *config.Config, logger *zap.Logger) (*App, error) {
	metricsServer := metrics.NewServer(cfg)

	redisClient, err := storage.NewRedisClient(ctx, cfg, logger)
	if err != nil {
		return nil, err
	}
	metricsServer.SetRedisClient(redisClient)

	dbStorage, err := storage.NewDBStorageWithRedis(ctx, cfg, logger, redisClient)
	if err != nil {
		redisClient.Close()
		return nil, err
	}

	esStorage, err := storage.NewESStorage(cfg, logger)
	if err != nil {
		dbStorage.Close()
		redisClient.Close()
		return nil, err
	}

	rmqConsumer, err := consumer.New(cfg)
	if err != nil {
		esStorage.Close()
		dbStorage.Close()
		redisClient.Close()
		return nil, err
	}

	return &App{
		Cfg:           cfg,
		Logger:        logger,
		MetricsServer: metricsServer,
		RedisClient:   redisClient,
		DBStorage:     dbStorage,
		ESStorage:     esStorage,
		Consumer:      rmqConsumer,
	}, nil
}

// Start begins all application services and blocks until completion or context cancellation
func (a *App) Start(ctx context.Context) error {
	a.MetricsServer.Start()

	deliveries, err := a.Consumer.Start(ctx)
	if err != nil {
		return err
	}

	a.startWorkerPool(ctx, deliveries)
	return nil
}

// startWorkerPool creates and manages goroutines to process incoming messages concurrently
func (a *App) startWorkerPool(ctx context.Context, deliveries <-chan amqp.Delivery) {
	var wg sync.WaitGroup

	for i := 0; i < a.Cfg.WorkerPoolSize; i++ {
		wg.Add(1)
		go a.worker(ctx, &wg, i+1, deliveries)
	}

	a.Logger.Info("Collector service started successfully. Waiting for messages...")
	wg.Wait()
	a.Logger.Info("All workers have shut down. Exiting.")
}

// worker processes messages from the deliveries channel
func (a *App) worker(ctx context.Context, wg *sync.WaitGroup, workerID int, deliveries <-chan amqp.Delivery) {
	defer wg.Done()
	a.Logger.Info("Worker started", zap.Int("workerId", workerID))

	for {
		select {
		case <-ctx.Done():
			a.Logger.Info("Worker shutting down", zap.Int("workerId", workerID))
			return
		case d, ok := <-deliveries:
			if !ok {
				a.Logger.Info("Deliveries channel closed, worker shutting down.", zap.Int("workerId", workerID))
				return
			}
			a.processMessage(ctx, workerID, d)
		}
	}
}

// processMessage contains the business logic for handling a single message
func (a *App) processMessage(ctx context.Context, workerID int, d amqp.Delivery) {
	metrics.MessagesProcessed.Inc()

	var event storage.LogEvent
	if err := json.Unmarshal(d.Body, &event); err != nil {
		a.Logger.Error("Failed to unmarshal message", zap.Error(err), zap.Int("workerId", workerID), zap.String("body", string(d.Body)))
		d.Nack(false, false)
		metrics.MessagesNacked.Inc()
		return
	}

	// 1. Send to relational DB (batched internally by DBStorage)
	a.DBStorage.AddToBatch(&event)

	// 2. Asynchronously send to Elasticsearch
	// Note: In an ideal scenario, Elasticsearch should also have a batching mechanism like dbStorage.AddToBatch
	// However, to keep this refactoring exactly identical in behavior, we preserve this concurrent call block.
	go func(e storage.LogEvent) {
		if err := a.ESStorage.BulkIndexLogEvents(ctx, []*storage.LogEvent{&e}); err != nil {
			a.Logger.Error("Failed to index log event to Elasticsearch", zap.Error(err), zap.String("eventId", e.EventID))
			// Here you might want to add metrics for ES failures
		}
	}(event)

	// 3. Acknowledge successful processing
	d.Ack(false)
	metrics.MessagesAcked.Inc()
}

// Close gracefully terminates all active connections
func (a *App) Close() {
	if a.Consumer != nil {
		a.Consumer.Close()
	}
	if a.ESStorage != nil {
		a.ESStorage.Close()
	}
	if a.DBStorage != nil {
		a.DBStorage.Close()
	}
	if a.RedisClient != nil {
		a.RedisClient.Close()
	}
}
