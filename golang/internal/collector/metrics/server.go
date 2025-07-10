package metrics

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"observability_hub/golang/internal/collector/config"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	MessagesProcessed = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_messages_processed_total",
		Help: "The total number of processed messages",
	})
	MessagesAcked = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_messages_acked_total",
		Help: "The total number of successfully acknowledged messages",
	})
	MessagesNacked = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_messages_nacked_total",
		Help: "The total number of nacked messages",
	})
	MessagesSkipped = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_messages_skipped_total",
		Help: "The total number of skipped duplicate messages",
	})
	DBFlushSuccess = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_db_flush_success_total",
		Help: "The total number of successful database flushes",
	})
	DBFlushErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_db_flush_errors_total",
		Help: "The total number of failed database flushes after retries",
	})
	DBFlushDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "collector_db_flush_duration_seconds",
		Help:    "The duration of database flush operations.",
		Buckets: prometheus.LinearBuckets(0.1, 0.1, 10), // 0.1s to 1s
	})
	// Redis-related metrics
	RedisCacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_redis_cache_hits_total",
		Help: "The total number of Redis cache hits",
	})
	RedisCacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_redis_cache_misses_total",
		Help: "The total number of Redis cache misses",
	})
	RedisErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "collector_redis_errors_total",
		Help: "The total number of Redis operation errors",
	})
	// Batch optimization metrics
	BatchSizeOptimized = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "collector_batch_size_optimized",
		Help:    "The optimized batch sizes used for processing",
		Buckets: prometheus.LinearBuckets(100, 100, 10), // 100 to 1000
	})
	CacheHitRatio = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "collector_cache_hit_ratio",
		Help: "The current cache hit ratio for metadata",
	})
	BatchProcessingTime = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "collector_batch_processing_time_seconds",
		Help:    "Time spent processing batches including Redis operations",
		Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // 1ms to ~30s
	})
)

// Server is the metrics and health check server.
type Server struct {
	httpServer *http.Server
	redis      HealthChecker
}

// HealthChecker interface for checking component health
type HealthChecker interface {
	HealthCheck() error
}

// NewServer creates a new metrics server.
func NewServer(cfg *config.Config) *Server {
	server := &Server{}

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", server.healthHandler)

	server.httpServer = &http.Server{
		Addr:    ":" + cfg.MetricsPort,
		Handler: mux,
	}

	return server
}

// SetRedisClient sets the Redis client for health checks
func (s *Server) SetRedisClient(redis HealthChecker) {
	s.redis = redis
}

// healthHandler handles health check requests
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	status := map[string]string{
		"status":  "OK",
		"service": "collector",
	}

	// Check Redis health if available
	if s.redis != nil {
		if err := s.redis.HealthCheck(); err != nil {
			status["redis"] = "ERROR: " + err.Error()
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			status["redis"] = "OK"
		}
	} else {
		status["redis"] = "DISABLED"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// Start runs the HTTP server in a new goroutine.
func (s *Server) Start() {
	log.Printf("Metrics and health server starting on %s", s.httpServer.Addr)
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s: %v\n", s.httpServer.Addr, err)
		}
	}()
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown(ctx context.Context) error {
	log.Println("Shutting down metrics and health server...")
	return s.httpServer.Shutdown(ctx)
}
