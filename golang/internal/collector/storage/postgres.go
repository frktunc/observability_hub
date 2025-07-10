package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"observability_hub/golang/internal/collector/config"
	"observability_hub/golang/internal/collector/metrics"
	"sync"
	"time"

	"database/sql/driver"

	"github.com/lib/pq"
	"go.uber.org/zap"
)

// LogEvent corresponds to the structure of the log data from JSON schema.
// We use pointers for optional fields.
type LogEvent struct {
	EventID       string    `json:"eventId"`
	EventType     string    `json:"eventType"`
	Version       string    `json:"version"`
	Timestamp     time.Time `json:"timestamp"`
	CorrelationID string    `json:"correlationId"`
	Source        Source    `json:"source"`
	Data          LogData   `json:"data"`
	Metadata      Metadata  `json:"metadata"`
	// Optional fields
	CausationID *string  `json:"causationId,omitempty"`
	Tracing     *Tracing `json:"tracing,omitempty"`
}

type Source struct {
	Service  string  `json:"service"`
	Version  string  `json:"version"`
	Instance *string `json:"instance,omitempty"`
	Region   *string `json:"region,omitempty"`
}

type Tracing struct {
	TraceID      string            `json:"traceId"`
	SpanID       *string           `json:"spanId,omitempty"`
	ParentSpanID *string           `json:"parentSpanId,omitempty"`
	Flags        *int              `json:"flags,omitempty"`
	Baggage      map[string]string `json:"baggage,omitempty"`
}

type Metadata struct {
	Priority    string         `json:"priority"`
	Tags        []string       `json:"tags,omitempty"`
	Environment *string        `json:"environment,omitempty"`
	RetryCount  *int           `json:"retryCount,omitempty"`
	SchemaURL   *string        `json:"schemaUrl,omitempty"`
	Extra       map[string]any `json:"-"` // For additional properties
}

type LogData struct {
	Level      string      `json:"level"`
	Message    string      `json:"message"`
	Timestamp  time.Time   `json:"timestamp"`
	Context    *LogContext `json:"context,omitempty"`
	Structured *JSONB      `json:"structured,omitempty"`
	Error      *LogError   `json:"error,omitempty"`
}

type LogContext struct {
	UserID    *string `json:"userId,omitempty"`
	SessionID *string `json:"sessionId,omitempty"`
	RequestID *string `json:"requestId,omitempty"`
	Operation *string `json:"operation,omitempty"`
	Component *string `json:"component,omitempty"`
}

type LogError struct {
	Type        *string `json:"type,omitempty"`
	Code        *string `json:"code,omitempty"`
	Stack       *string `json:"stack,omitempty"`
	Cause       *string `json:"cause,omitempty"`
	Fingerprint *string `json:"fingerprint,omitempty"`
}

// JSONB is a helper type for handling jsonb fields.
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface.
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface.
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("Scan source is not []byte")
	}
	return json.Unmarshal(bytes, j)
}

// DBStorage handles database operations.
type DBStorage struct {
	db          *sql.DB
	cfg         *config.Config
	redis       *RedisClient
	buffer      chan *LogEvent
	wg          sync.WaitGroup
	mu          sync.Mutex
	ticker      *time.Ticker
	ctx         context.Context
	cancel      context.CancelFunc
	logger      *zap.Logger
	metadataMap sync.Map // In-memory cache for frequently accessed metadata
}

// NewDBStorage creates a new DBStorage instance without Redis.
func NewDBStorage(ctx context.Context, cfg *config.Config, logger *zap.Logger) (*DBStorage, error) {
	return NewDBStorageWithRedis(ctx, cfg, logger, nil)
}

// NewDBStorageWithRedis creates a new DBStorage instance with Redis support.
func NewDBStorageWithRedis(ctx context.Context, cfg *config.Config, logger *zap.Logger, redis *RedisClient) (*DBStorage, error) {
	db, err := sql.Open("postgres", cfg.PostgresURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	childCtx, cancel := context.WithCancel(ctx)

	storage := &DBStorage{
		db:     db,
		cfg:    cfg,
		redis:  redis,
		buffer: make(chan *LogEvent, cfg.BatchSize*2),
		ticker: time.NewTicker(cfg.BatchTimeout),
		ctx:    childCtx,
		cancel: cancel,
		logger: logger.Named("storage"),
	}

	storage.wg.Add(1)
	go storage.batchProcessor()

	return storage, nil
}

// AddToBatch adds a log event to the processing buffer.
func (s *DBStorage) AddToBatch(event *LogEvent) {
	// Check for deduplication if Redis is available
	if s.redis != nil {
		isDuplicate, err := s.redis.CheckDuplication(event)
		if err != nil {
			s.logger.Warn("Failed to check duplication, proceeding with event",
				zap.Error(err),
				zap.String("event_id", event.EventID))
		} else if isDuplicate {
			s.logger.Debug("Duplicate event detected, skipping",
				zap.String("event_id", event.EventID),
				zap.String("service", event.Source.Service))
			metrics.MessagesSkipped.Inc()
			return
		}

		// Mark as processed immediately to prevent race conditions
		if err := s.redis.MarkAsProcessed(event); err != nil {
			s.logger.Warn("Failed to mark event as processed",
				zap.Error(err),
				zap.String("event_id", event.EventID))
		}
	}

	s.buffer <- event
}

func (s *DBStorage) batchProcessor() {
	defer s.wg.Done()
	batch := make([]*LogEvent, 0, s.cfg.BatchSize)
	batchOptimizer := s.createBatchOptimizer()

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info("Batch processor shutting down. Flushing remaining logs...", zap.Int("batch_size", len(batch)))
			s.flushWithRetry(batch)
			return
		case <-s.ticker.C:
			if len(batch) > 0 {
				optimizedSize := batchOptimizer.getOptimalBatchSize(batch)
				s.logger.Info("Batch timeout reached. Flushing logs.",
					zap.Int("batch_size", len(batch)),
					zap.Int("optimal_size", optimizedSize))

				// Record metrics
				metrics.BatchSizeOptimized.Observe(float64(len(batch)))
				metrics.CacheHitRatio.Set(batchOptimizer.cacheHitRatio)

				s.flushWithRetry(batch)
				batch = make([]*LogEvent, 0, s.cfg.BatchSize)
			}
		case event := <-s.buffer:
			batch = append(batch, event)

			// Use dynamic batch sizing based on Redis cache effectiveness
			targetBatchSize := batchOptimizer.getOptimalBatchSize(batch)
			if len(batch) >= targetBatchSize {
				s.logger.Info("Optimal batch size reached. Flushing logs.",
					zap.Int("batch_size", len(batch)),
					zap.Int("optimal_size", targetBatchSize))

				// Record metrics
				metrics.BatchSizeOptimized.Observe(float64(len(batch)))
				metrics.CacheHitRatio.Set(batchOptimizer.cacheHitRatio)

				s.flushWithRetry(batch)
				batch = make([]*LogEvent, 0, s.cfg.BatchSize)
			}
		}
	}
}

func (s *DBStorage) flushWithRetry(batch []*LogEvent) {
	if len(batch) == 0 {
		return
	}

	timer := time.Now()
	operation := func() error {
		return s.flush(batch)
	}

	err := s.retryWithBackoff(operation)
	if err != nil {
		s.logger.Error("Failed to flush batch after multiple retries",
			zap.Error(err),
			zap.Int("batch_size", len(batch)),
		)
		metrics.DBFlushErrors.Inc()
	} else {
		metrics.DBFlushSuccess.Inc()
		metrics.DBFlushDuration.Observe(time.Since(timer).Seconds())
	}
}

func (s *DBStorage) flush(batch []*LogEvent) error {
	if len(batch) == 0 {
		return nil
	}

	// Measure batch processing time including Redis operations
	batchTimer := time.Now()
	defer func() {
		metrics.BatchProcessingTime.Observe(time.Since(batchTimer).Seconds())
	}()

	// Process metadata caching before database operations
	if s.redis != nil {
		s.processMetadataCache(batch)
	}

	txn, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer txn.Rollback() // Rollback is a no-op if Commit succeeds.

	stmt, err := txn.Prepare(pq.CopyIn("logs",
		"event_id", "correlation_id", "timestamp", "level", "service", "message", "context", "error", "structured", "metadata",
	))
	if err != nil {
		return fmt.Errorf("failed to prepare copy in statement: %w", err)
	}

	for _, event := range batch {
		// Use cached metadata if available
		contextJSON, errorJSON, structuredJSON, metadataJSON := s.prepareEventData(event)

		_, err = stmt.Exec(
			event.EventID,
			event.CorrelationID,
			event.Timestamp,
			event.Data.Level,
			event.Source.Service,
			event.Data.Message,
			contextJSON,
			errorJSON,
			structuredJSON,
			metadataJSON,
		)
		if err != nil {
			// The entire COPY operation will be rolled back.
			return fmt.Errorf("failed to exec copy in statement: %w", err)
		}
	}

	if _, err := stmt.Exec(); err != nil {
		return fmt.Errorf("failed to finalize copy in: %w", err)
	}

	if err := stmt.Close(); err != nil {
		return fmt.Errorf("failed to close statement: %w", err)
	}

	if err := txn.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Update batch counters
	if s.redis != nil {
		serviceCounters := make(map[string]int)
		for _, event := range batch {
			serviceCounters[event.Source.Service]++
		}

		for service, count := range serviceCounters {
			for i := 0; i < count; i++ {
				s.redis.IncrementBatchCounter(service)
			}
		}
	}

	s.logger.Info("Successfully flushed logs to the database.", zap.Int("count", len(batch)))
	return nil
}

func (s *DBStorage) retryWithBackoff(operation func() error) error {
	var err error
	backoff := s.cfg.RetryInterval
	for i := 0; i < s.cfg.RetryMax; i++ {
		err = operation()
		if err == nil {
			return nil
		}
		s.logger.Warn("Operation failed, retrying...",
			zap.Int("attempt", i+1),
			zap.Int("max_attempts", s.cfg.RetryMax),
			zap.Duration("backoff", backoff),
			zap.Error(err),
		)
		time.Sleep(backoff)
		backoff *= 2 // Exponential backoff
	}
	return fmt.Errorf("operation failed after %d attempts: %w", s.cfg.RetryMax, err)
}

// Close gracefully shuts down the storage.
func (s *DBStorage) Close() {
	s.cancel()
	s.wg.Wait()
	close(s.buffer)

	// Flush any remaining items in the channel buffer
	finalBatch := make([]*LogEvent, 0, len(s.buffer))
	for event := range s.buffer {
		finalBatch = append(finalBatch, event)
	}
	s.flushWithRetry(finalBatch)

	s.db.Close()
	s.logger.Info("Database connection closed.")
}

// processMetadataCache handles metadata caching for a batch of events
func (s *DBStorage) processMetadataCache(batch []*LogEvent) {
	processed := make(map[string]bool)

	for _, event := range batch {
		key := fmt.Sprintf("%s:%s:%s",
			event.Source.Service,
			event.Source.Version,
			getEnvironmentFromMetadata(&event.Metadata))

		if processed[key] {
			continue
		}
		processed[key] = true

		// Check if metadata is already cached
		cachedMetadata, err := s.redis.GetCachedMetadata(
			event.Source.Service,
			event.Source.Version,
			getEnvironmentFromMetadata(&event.Metadata),
		)

		if err != nil {
			metrics.RedisErrors.Inc()
			s.logger.Warn("Failed to get cached metadata",
				zap.Error(err),
				zap.String("service", event.Source.Service))
			continue
		}

		if cachedMetadata == nil {
			// Cache miss - create and store metadata
			metadata := &CachedMetadata{
				ServiceID:   event.Source.Service,
				Environment: getEnvironmentFromMetadata(&event.Metadata),
				Version:     event.Source.Version,
				Attributes: map[string]interface{}{
					"region":   event.Source.Region,
					"instance": event.Source.Instance,
				},
				CachedAt: time.Now(),
			}

			if err := s.redis.CacheMetadata(
				event.Source.Service,
				event.Source.Version,
				getEnvironmentFromMetadata(&event.Metadata),
				metadata,
			); err != nil {
				metrics.RedisErrors.Inc()
				s.logger.Warn("Failed to cache metadata",
					zap.Error(err),
					zap.String("service", event.Source.Service))
			} else {
				metrics.RedisCacheMisses.Inc()
				s.metadataMap.Store(key, metadata)
			}
		} else {
			// Cache hit - store in local map for faster access
			metrics.RedisCacheHits.Inc()
			s.metadataMap.Store(key, cachedMetadata)
		}
	}
}

// prepareEventData prepares JSON data for database insertion with optimized metadata handling
func (s *DBStorage) prepareEventData(event *LogEvent) ([]byte, []byte, []byte, []byte) {
	// Use cached serialization for frequently accessed data
	contextJSON, _ := json.Marshal(event.Data.Context)
	errorJSON, _ := json.Marshal(event.Data.Error)
	structuredJSON, _ := json.Marshal(event.Data.Structured)

	// Try to use cached metadata JSON if available
	metadataKey := fmt.Sprintf("%s:%s:%s",
		event.Source.Service,
		event.Source.Version,
		getEnvironmentFromMetadata(&event.Metadata))

	if cachedMeta, ok := s.metadataMap.Load(metadataKey); ok {
		if metadata, ok := cachedMeta.(*CachedMetadata); ok {
			// Use optimized metadata structure
			optimizedMetadata := map[string]interface{}{
				"priority":          event.Metadata.Priority,
				"tags":              event.Metadata.Tags,
				"environment":       metadata.Environment,
				"retry_count":       event.Metadata.RetryCount,
				"schema_url":        event.Metadata.SchemaURL,
				"cached_attributes": metadata.Attributes,
			}
			metadataJSON, _ := json.Marshal(optimizedMetadata)
			return contextJSON, errorJSON, structuredJSON, metadataJSON
		}
	}

	// Fallback to normal metadata marshaling
	metadataJSON, _ := json.Marshal(event.Metadata)
	return contextJSON, errorJSON, structuredJSON, metadataJSON
}

// getEnvironmentFromMetadata extracts environment from metadata
func getEnvironmentFromMetadata(metadata *Metadata) string {
	if metadata.Environment != nil {
		return *metadata.Environment
	}
	return "unknown"
}

// BatchOptimizer helps optimize batch sizes based on Redis cache performance
type BatchOptimizer struct {
	baseBatchSize     int
	maxBatchSize      int
	cacheHitRatio     float64
	lastOptimization  time.Time
	serviceCacheStats map[string]*ServiceCacheStats
}

// ServiceCacheStats tracks cache performance per service
type ServiceCacheStats struct {
	CacheHits   int64
	CacheMisses int64
	LastUpdated time.Time
}

// createBatchOptimizer creates a new batch optimizer
func (s *DBStorage) createBatchOptimizer() *BatchOptimizer {
	return &BatchOptimizer{
		baseBatchSize:     s.cfg.BatchSize,
		maxBatchSize:      s.cfg.BatchSize * 2, // Allow up to 2x base size
		cacheHitRatio:     0.5,                 // Start with 50% assumption
		lastOptimization:  time.Now(),
		serviceCacheStats: make(map[string]*ServiceCacheStats),
	}
}

// getOptimalBatchSize calculates optimal batch size based on current conditions
func (bo *BatchOptimizer) getOptimalBatchSize(batch []*LogEvent) int {
	// Update cache statistics if enough time has passed
	if time.Since(bo.lastOptimization) > 30*time.Second {
		bo.updateCacheStats(batch)
		bo.lastOptimization = time.Now()
	}

	// If cache hit ratio is high, we can process larger batches more efficiently
	if bo.cacheHitRatio > 0.7 {
		// High cache efficiency - use larger batches
		return int(float64(bo.baseBatchSize) * 1.5)
	} else if bo.cacheHitRatio < 0.3 {
		// Low cache efficiency - use smaller batches for faster processing
		return int(float64(bo.baseBatchSize) * 0.8)
	}

	// Medium efficiency - use base batch size
	return bo.baseBatchSize
}

// updateCacheStats updates cache statistics for optimization
func (bo *BatchOptimizer) updateCacheStats(batch []*LogEvent) {
	if len(batch) == 0 {
		return
	}

	// Simulate cache effectiveness calculation
	// In a real implementation, this would track actual Redis performance
	serviceStats := make(map[string]int)
	for _, event := range batch {
		serviceStats[event.Source.Service]++
	}

	// Update cache hit ratio based on service diversity
	// More diverse services typically mean lower cache hit ratios
	diversity := float64(len(serviceStats)) / float64(len(batch))

	// High diversity (many different services) = lower cache hit ratio
	// Low diversity (few services repeated) = higher cache hit ratio
	bo.cacheHitRatio = 1.0 - (diversity * 0.7) // Max reduction of 70%

	if bo.cacheHitRatio < 0.1 {
		bo.cacheHitRatio = 0.1 // Minimum 10% hit ratio
	}
}
