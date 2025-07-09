package config

import (
	"os"
	"strconv"
	"time"
)

// Config stores all configuration for the application.
// The values are read from environment variables.
type Config struct {
	RabbitMQURL     string
	PostgresURL     string
	QueueName       string
	DLXName         string
	DLQName         string
	BatchSize       int
	BatchTimeout    time.Duration
	WorkerPoolSize  int
	MetricsPort     string
	HealthCheckPort string
	RetryMax        int
	RetryInterval   time.Duration
}

// Load reads configuration from environment variables and returns a new Config struct.
func Load() (*Config, error) {
	batchSize, err := strconv.Atoi(getEnv("COLLECTOR_BATCH_SIZE", "100"))
	if err != nil {
		return nil, err
	}

	workerPoolSize, err := strconv.Atoi(getEnv("COLLECTOR_WORKER_POOL_SIZE", "10"))
	if err != nil {
		return nil, err
	}

	retryMax, err := strconv.Atoi(getEnv("COLLECTOR_RETRY_MAX", "3"))
	if err != nil {
		return nil, err
	}

	batchTimeout, err := time.ParseDuration(getEnv("COLLECTOR_BATCH_TIMEOUT", "5s"))
	if err != nil {
		return nil, err
	}

	retryInterval, err := time.ParseDuration(getEnv("COLLECTOR_RETRY_INTERVAL", "2s"))
	if err != nil {
		return nil, err
	}

	cfg := &Config{
		RabbitMQURL:     getEnv("RABBITMQ_URL", "amqp://obs_user:obs_password@obs_rabbitmq:5672/"),
		PostgresURL:     getEnv("POSTGRES_URL", "postgres://user:password@localhost:5432/logs?sslmode=disable"),
		QueueName:       getEnv("RABBITMQ_QUEUE_NAME", "log_events"),
		DLXName:         getEnv("RABBITMQ_DLX_NAME", "log_events_dlx"),
		DLQName:         getEnv("RABBITMQ_DLQ_NAME", "log_events_dlq"),
		MetricsPort:     getEnv("METRICS_PORT", "9090"),
		HealthCheckPort: getEnv("HEALTH_CHECK_PORT", "8081"),
		BatchSize:       batchSize,
		WorkerPoolSize:  workerPoolSize,
		RetryMax:        retryMax,
		BatchTimeout:    batchTimeout,
		RetryInterval:   retryInterval,
	}
	return cfg, nil
}

// getEnv retrieves an environment variable or returns a default value.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
