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
	db     *sql.DB
	cfg    *config.Config
	buffer chan *LogEvent
	wg     sync.WaitGroup
	mu     sync.Mutex
	ticker *time.Ticker
	ctx    context.Context
	cancel context.CancelFunc
	logger *zap.Logger
}

// NewDBStorage creates a new DBStorage instance.
func NewDBStorage(ctx context.Context, cfg *config.Config, logger *zap.Logger) (*DBStorage, error) {
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
	s.buffer <- event
}

func (s *DBStorage) batchProcessor() {
	defer s.wg.Done()
	batch := make([]*LogEvent, 0, s.cfg.BatchSize)

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info("Batch processor shutting down. Flushing remaining logs...", zap.Int("batch_size", len(batch)))
			s.flushWithRetry(batch)
			return
		case <-s.ticker.C:
			if len(batch) > 0 {
				s.logger.Info("Batch timeout reached. Flushing logs.", zap.Int("batch_size", len(batch)))
				s.flushWithRetry(batch)
				batch = make([]*LogEvent, 0, s.cfg.BatchSize)
			}
		case event := <-s.buffer:
			batch = append(batch, event)
			if len(batch) >= s.cfg.BatchSize {
				s.logger.Info("Batch size reached. Flushing logs.", zap.Int("batch_size", len(batch)))
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
		contextJSON, _ := json.Marshal(event.Data.Context)
		errorJSON, _ := json.Marshal(event.Data.Error)
		structuredJSON, _ := json.Marshal(event.Data.Structured)
		metadataJSON, _ := json.Marshal(event.Metadata)

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
