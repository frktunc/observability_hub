package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"observability_hub/golang/internal/collector/app"
	"observability_hub/golang/internal/collector/config"

	"go.uber.org/zap"
)

func main() {
	// 1. Initialize Logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("can't initialize zap logger: %v", err)
	}
	defer logger.Sync()

	// 2. Load Configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// 3. Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4. Initialize the App (Dependency Injection Container)
	application, err := app.New(ctx, cfg, logger)
	if err != nil {
		logger.Fatal("Failed to initialize application dependencies", zap.Error(err))
	}
	defer application.Close()

	// 5. Handle OS Signals for Graceful Shutdown
	go handleShutdownSignals(application, cancel, logger)

	// 6. Start the App (Blocks until workers finish or context is cancelled)
	if err := application.Start(ctx); err != nil {
		logger.Fatal("Application encountered a fatal error while starting", zap.Error(err))
	}
}

// handleShutdownSignals listens for SIGINT/SIGTERM and coordinates a graceful shutdown
func handleShutdownSignals(application *app.App, cancel context.CancelFunc, logger *zap.Logger) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	logger.Info("Shutdown signal received, initiating graceful shutdown...")

	// Give the server 10 seconds to finish currently processing requests
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	application.MetricsServer.Shutdown(shutdownCtx)

	// Cancel the main context to signal workers to stop
	cancel()
}
