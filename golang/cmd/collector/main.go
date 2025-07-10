package main

import (
	"context"
	"encoding/json"
	"log"
	"observability_hub/golang/internal/collector/config"
	"observability_hub/golang/internal/collector/consumer"
	"observability_hub/golang/internal/collector/metrics"
	"observability_hub/golang/internal/collector/storage"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"go.uber.org/zap"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("can't initialize zap logger: %v", err)
	}
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	metricsServer := metrics.NewServer(cfg)
	metricsServer.Start()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		logger.Info("Shutdown signal received, initiating graceful shutdown...")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		metricsServer.Shutdown(shutdownCtx)
		cancel()
	}()

	// Initialize Redis client
	redisClient, err := storage.NewRedisClient(ctx, cfg, logger)
	if err != nil {
		logger.Fatal("Failed to create Redis client", zap.Error(err))
	}
	defer redisClient.Close()

	// Set Redis client for health checks
	metricsServer.SetRedisClient(redisClient)

	dbStorage, err := storage.NewDBStorageWithRedis(ctx, cfg, logger, redisClient)
	if err != nil {
		logger.Fatal("Failed to create database storage", zap.Error(err))
	}
	defer dbStorage.Close()

	rmqConsumer, err := consumer.New(cfg)
	if err != nil {
		logger.Fatal("Failed to create RabbitMQ consumer", zap.Error(err))
	}
	defer rmqConsumer.Close()

	deliveries, err := rmqConsumer.Start(ctx)
	if err != nil {
		logger.Fatal("Failed to start consuming messages", zap.Error(err))
	}

	var wg sync.WaitGroup
	for i := 0; i < cfg.WorkerPoolSize; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			logger.Info("Worker started", zap.Int("workerId", workerID))
			for {
				select {
				case <-ctx.Done():
					logger.Info("Worker shutting down", zap.Int("workerId", workerID))
					return
				case d, ok := <-deliveries:
					if !ok {
						logger.Info("Deliveries channel closed, worker shutting down.", zap.Int("workerId", workerID))
						return
					}
					metrics.MessagesProcessed.Inc()

					var event storage.LogEvent
					if err := json.Unmarshal(d.Body, &event); err != nil {
						logger.Error("Failed to unmarshal message", zap.Error(err), zap.Int("workerId", workerID), zap.String("body", string(d.Body)))
						d.Nack(false, false)
						metrics.MessagesNacked.Inc()
						continue
					}

					dbStorage.AddToBatch(&event)
					d.Ack(false)
					metrics.MessagesAcked.Inc()
				}
			}
		}(i + 1)
	}

	logger.Info("Collector service started successfully. Waiting for messages...")
	wg.Wait()
	logger.Info("All workers have shut down. Exiting.")
}
