package metrics

import (
	"context"
	"fmt"
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
)

// Server is the metrics and health check server.
type Server struct {
	httpServer *http.Server
}

// NewServer creates a new metrics server.
func NewServer(cfg *config.Config) *Server {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "OK")
	})

	return &Server{
		httpServer: &http.Server{
			Addr:    ":" + cfg.MetricsPort,
			Handler: mux,
		},
	}
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
