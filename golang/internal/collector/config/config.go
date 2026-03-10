package config

import (
	"os"
	"strconv"
	"time"
)

// Config: Uygulamanın tüm çalışma parametrelerini tutan ana yapı.
// Değerler çevre değişkenlerinden (Environment Variables) beslenir.
type Config struct {
	// Mesaj Kuyruğu (RabbitMQ) Ayarları
	RabbitMQURL  string
	QueueName    string
	ExchangeName string
	DLXName      string // Dead Letter Exchange (Hatalı mesajların yönlendirileceği yer)
	DLQName      string // Dead Letter Queue (Hatalı mesajların birikeceği kuyruk)

	// Veritabanı ve Depolama Ayarları
	PostgresURL      string
	ElasticsearchURL string

	// Collector (Toplayıcı) Davranış Ayarları
	BatchSize      int           // Tek seferde işlenecek maksimum mesaj sayısı
	BatchTimeout   time.Duration // Belirlenen sayıya ulaşılmasa bile beklenilecek süre
	WorkerPoolSize int           // Paralel çalışacak işçi (goroutine) sayısı

	// İzlenebilirlik (Observability) Portları
	MetricsPort     string // Prometheus vb. için metrik adresi
	HealthCheckPort string // Kubernetes veya Load Balancer için sağlık kontrolü

	// Yeniden Deneme (Retry) Politikası
	RetryMax      int           // Başarısız işlemde maksimum deneme sayısı
	RetryInterval time.Duration // Denemeler arasındaki bekleme süresi

	// Redis Önbellek (Cache) Yapılandırması
	RedisURL        string
	RedisPassword   string
	RedisDB         int
	RedisPoolSize   int // Aktif tutulacak bağlantı havuzu boyutu
	RedisMinIdle    int // Boşta bekletilecek minimum bağlantı
	RedisMaxRetries int
	RedisTTL        time.Duration // Verinin bellekte kalma süresi
}

// Load: Çevre değişkenlerini okur, veri tiplerini dönüştürür ve Config nesnesini döner.
func Load() (*Config, error) {
	// Sayısal değerlerin (string -> int) ve sürelerin (string -> duration) dönüşümü
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

	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		return nil, err
	}

	redisPoolSize, err := strconv.Atoi(getEnv("REDIS_POOL_SIZE", "10"))
	if err != nil {
		return nil, err
	}

	redisMinIdle, err := strconv.Atoi(getEnv("REDIS_MIN_IDLE", "5"))
	if err != nil {
		return nil, err
	}

	redisMaxRetries, err := strconv.Atoi(getEnv("REDIS_MAX_RETRIES", "3"))
	if err != nil {
		return nil, err
	}

	redisTTL, err := time.ParseDuration(getEnv("REDIS_TTL", "1h"))
	if err != nil {
		return nil, err
	}

	// Config struct'ının varsayılan değerlerle veya env verileriyle oluşturulması
	cfg := &Config{
		RabbitMQURL:     getEnv("RABBITMQ_URL", "amqp://obs_user:obs_password@obs_rabbitmq:5672/"),
		PostgresURL:     getEnv("POSTGRES_URL", "postgres://user:password@localhost:5432/logs?sslmode=disable"),
		QueueName:       getEnv("RABBITMQ_QUEUE_NAME", "logs.collector"),
		ExchangeName:    getEnv("RABBITMQ_EXCHANGE", "logs.topic"),
		DLXName:         getEnv("RABBITMQ_DLX_NAME", "dlx.logs"),
		DLQName:         getEnv("RABBITMQ_DLQ_NAME", "dlq.logs"),
		MetricsPort:     getEnv("METRICS_PORT", "9090"),
		HealthCheckPort: getEnv("HEALTH_CHECK_PORT", "8081"),
		BatchSize:       batchSize,
		WorkerPoolSize:  workerPoolSize,
		RetryMax:        retryMax,
		BatchTimeout:    batchTimeout,
		RetryInterval:   retryInterval,

		// Redis Yapılandırması
		RedisURL:        getEnv("REDIS_URL", "redis://obs_redis:6379"),
		RedisPassword:   getEnv("REDIS_PASSWORD", ""),
		RedisDB:         redisDB,
		RedisPoolSize:   redisPoolSize,
		RedisMinIdle:    redisMinIdle,
		RedisMaxRetries: redisMaxRetries,
		RedisTTL:        redisTTL,

		// Elasticsearch Yapılandırması
		ElasticsearchURL: getEnv("ELASTICSEARCH_URL", "http://localhost:9200"),
	}
	return cfg, nil
}

// getEnv: Belirtilen anahtarı (key) sistemde arar, bulamazsa varsayılanı (fallback) döner.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
