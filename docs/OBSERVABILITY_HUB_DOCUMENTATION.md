# Observability Hub – Kapsamlı Dokümantasyon

Bu doküman önce Go ile yazılmış **Collector** servisini ayrıntılı biçimde anlatır; ardından proje mimarisi ve bileşenlere kısa bir özet sunar.

---

# Bölüm A: Go Collector Servisi

## A.1 Giriş ve Rol

**Collector**, Observability Hub projesindeki tek Go servisidir. Görevi:

- **user-service**, **order-service** ve **product-service** (Node.js) tarafından RabbitMQ’ya publish edilen **log event’lerini** tüketmek,
- Bu event’leri **PostgreSQL**, **Redis** ve **Elasticsearch**’e yazmak,  (NEDEN BU EVENTLERİ SADECE POSTGRESQL YERİNE REDİS VE ELASTİCSEARCHE DE YAZIYOR)
- **Prometheus** metrikleri ve **health** endpoint’i sunmak.

Entry point: `golang/cmd/collector/main.go`.

---

## A.2 Mimari ve Veri Akışı

Collector bileşenleri:

- **Config:** Ortam değişkenlerinden konfigürasyon
- **Consumer:** RabbitMQ AMQP consumer (topic exchange, queue, DLX/DLQ)
- **Storage:** PostgreSQL (batch), Redis (dedup + metadata cache), Elasticsearch (async index)
- **Metrics server:** HTTP server (Prometheus `/metrics`, `/health`)
- **Worker pool:** Mesajları okuyup işleyen goroutine’ler

Veri akışı (özet):

```mermaid
flowchart LR
  subgraph sources [Kaynaklar]
    UserSvc[user-service]
    OrderSvc[order-service]
    ProductSvc[product-service]
  end
  subgraph mq [RabbitMQ]
    Exchange[logs.topic]
    Queue[logs.collector]
  end
  subgraph collector [Collector]
    Consumer[Consumer]
    Workers[Worker Pool]
    DBStorage[DBStorage]
    ESStorage[ESStorage]
  end
  subgraph sinks [Hedefler]
    Postgres[(PostgreSQL)]
    Redis[(Redis)]
    Elasticsearch[(Elasticsearch)]
  end
  UserSvc --> Exchange
  OrderSvc --> Exchange
  ProductSvc --> Exchange
  Exchange -->|"logs.#"| Queue
  Queue --> Consumer
  Consumer --> Workers
  Workers --> DBStorage
  Workers --> ESStorage
  DBStorage --> Postgres
  DBStorage --> Redis
  ESStorage --> Elasticsearch
```

- Mikroservisler `logs.topic` exchange’e log event’leri publish eder.
- Collector, `logs.collector` kuyruğundan `logs.#` routing key ile mesaj alır.
- Worker’lar her mesajı JSON’dan parse eder; PostgreSQL’e batch ile, Redis’e dedup/cache, Elasticsearch’e async tek event olarak yazar.

---

## A.3 Konfigürasyon

Konfigürasyon **ortam değişkenlerinden** okunur. Kaynak: `golang/internal/collector/config/config.go`.

| Alan | Ortam değişkeni | Varsayılan (kod) |

|------|------------------|-------------------|
| RabbitMQ URL | `RABBITMQ_URL` | `amqp://obs_user:obs_password@obs_rabbitmq:5672/` |
| Queue | `RABBITMQ_QUEUE_NAME` | `logs.collector` |
| Exchange | `RABBITMQ_EXCHANGE` | `logs.topic` |
| DLX | `RABBITMQ_DLX_NAME` | `dlx.logs` |
| DLQ | `RABBITMQ_DLQ_NAME` | `dlq.logs` |
| Postgres URL | `POSTGRES_URL` | `postgres://user:password@localhost:5432/logs?sslmode=disable` |
| Batch size | `COLLECTOR_BATCH_SIZE` | `100` |
| Batch timeout | `COLLECTOR_BATCH_TIMEOUT` | `5s` |
| Worker pool size | `COLLECTOR_WORKER_POOL_SIZE` | `10` |
| Retry max | `COLLECTOR_RETRY_MAX` | `3` |
| Retry interval | `COLLECTOR_RETRY_INTERVAL` | `2s` |
| Metrics port | `METRICS_PORT` | `9090` |
| Health check port | `HEALTH_CHECK_PORT` | `8081` |
| Redis URL | `REDIS_URL` | `redis://obs_redis:6379` |
| Redis password | `REDIS_PASSWORD` | (boş) |
| Redis DB | `REDIS_DB` | `0` |
| Redis pool size | `REDIS_POOL_SIZE` | `10` |
| Redis min idle | `REDIS_MIN_IDLE` | `5` |
| Redis max retries | `REDIS_MAX_RETRIES` | `3` |
| Redis TTL | `REDIS_TTL` | `1h` |
| Elasticsearch URL | `ELASTICSEARCH_URL` | `http://localhost:9200` |

Docker Compose’da collector için örnek env (satır 160–178): `RABBITMQ_URL`, `POSTGRES_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `COLLECTOR_BATCH_SIZE=500`, `COLLECTOR_WORKER_POOL_SIZE=20`, `METRICS_PORT=9090`, `HEALTH_CHECK_PORT=8083` vb. tanımlıdır.

**Not:** Kodda tek HTTP server `METRICS_PORT` (9090) üzerinde çalışır; hem `/metrics` hem `/health` bu portta sunulur. `HEALTH_CHECK_PORT` (8083) Docker’da expose edilse de uygulama içinde ayrı bir health server yok.

---

## A.4 RabbitMQ Consumer

Dosya: `golang/internal/collector/consumer/consumer.go`.

- **Bağlantı:** `amqp.Dial(cfg.RabbitMQURL)` ile connection, sonra channel açılır.
- **Exchange:** Topic exchange `logs.topic` (durable) declare edilir.
- **DLX/DLQ:** Dead Letter Exchange `dlx.logs` (direct), Dead Letter Queue `dlq.logs` declare ve bind edilir.
- **Ana kuyruk:** `logs.collector` kuyruğu `x-dead-letter-exchange: dlx.logs` argümanı ile declare edilir; böylece başarısız mesajlar DLQ’ya gider.
- **Bind:** Ana kuyruk `logs.#` routing key ile `logs.topic` exchange’e bağlanır.
- **Consume:** `channel.Consume(..., autoAck: false)` ile delivery channel alınır; mesajlar manuel ack’lenir.
- **Ack/Nack:** İşlem başarılıysa `Ack(false)`; JSON unmarshal hatasında `Nack(false, false)` ve mesaj DLQ’ya düşer.

Context iptal edildiğinde consumer goroutine’i `Close()` çağırarak bağlantıyı kapatır.

---

## A.5 Worker Döngüsü ve Event İşleme

Dosya: `golang/cmd/collector/main.go` (yaklaşık 82–124. satırlar).

- **Worker sayısı:** `cfg.WorkerPoolSize` (Docker’da 20).
- **Channel:** Her worker aynı `deliveries` channel’dan okur (RabbitMQ’dan gelen mesajlar).

Her mesaj için akış:

1. **JSON unmarshal:** `d.Body` -> `storage.LogEvent`. Hata varsa: `Nack(false, false)`, `MessagesNacked.Inc()`, `continue`.
2. **PostgreSQL:** `dbStorage.AddToBatch(&event)` ile event batch buffer’a eklenir (içeride Redis dedup varsa kontrol edilir).
3. **Elasticsearch:** `go func(e storage.LogEvent) { ... }(event)` ile her event için ayrı goroutine’de `esStorage.BulkIndexLogEvents(ctx, []*LogEvent{&e})` çağrılır. ES hatası sadece loglanır; mesaj yine ack’lenir.
4. **Ack:** `d.Ack(false)` ve `MessagesAcked.Inc()`.

Event yapısı (`storage.LogEvent`, `golang/internal/collector/storage/postgres.go` 19–81):

- **Üst seviye:** `EventID`, `EventType`, `Version`, `Timestamp`, `CorrelationID`, `Source`, `Data`, `Metadata`; opsiyonel: `CausationID`, `Tracing`.
- **Source:** `Service`, `Version`, `Instance`, `Region`.
- **Data (LogData):** `Level`, `Message`, `Timestamp`, `Context`, `Structured`, `Error`.
- **Metadata:** `Priority`, `Tags`, `Environment`, `RetryCount`, `SchemaURL` vb.

---

## A.6 PostgreSQL Storage (Batch Yazma)

Dosya: `golang/internal/collector/storage/postgres.go`.

**DBStorage:**

- Postgres’e bağlanır; connection pool (MaxOpenConns 25, MaxIdleConns 25) kullanır.
- **Buffer:** `cfg.BatchSize*2` kapasiteli channel ile event’ler toplanır.

**AddToBatch:**

- Redis varsa önce **deduplication:** `redis.CheckDuplication(event)`. Duplicate ise event atlanır, `MessagesSkipped.Inc()`.
- Duplicate değilse `redis.MarkAsProcessed(event)` (24 saat TTL ile EventID+CorrelationID key).
- Event buffer channel’a gönderilir.

**batchProcessor (goroutine):**

- İki tetikleyici:
  - **Ticker:** `cfg.BatchTimeout` (örn. 5s) dolunca batch’te en az bir event varsa flush.
  - **Boyut:** `BatchOptimizer.getOptimalBatchSize(batch)` ile hedeflenen boyuta ulaşınca flush.
- **Flush:** `flushWithRetry` -> `flush`. Retry: exponential backoff, en fazla `RetryMax` deneme.

**flush:**

- Transaction içinde `pq.CopyIn("logs", ...)` ile toplu insert.
- Kolonlar: `event_id`, `correlation_id`, `timestamp`, `level`, `service`, `message`, `context`, `error`, `structured`, `metadata`.
- Redis varsa flush öncesi `processMetadataCache(batch)` ile metadata cache doldurulur; `prepareEventData` ile event’ler hazırlanır (cached metadata kullanılabilir).
- **BatchOptimizer:** Cache hit ratio’ya göre optimal batch boyutu (yüksek ratio -> daha büyük batch, düşük -> daha küçük). Metrik: `BatchSizeOptimized`, `CacheHitRatio`.

**Close:** Context iptal, buffer kapatılır; kalan event’ler flush edilir, DB kapatılır.

---

## A.7 Redis

Dosya: `golang/internal/collector/storage/redis.go`.

Kullanım alanları:

- **Deduplication:** Key `collector:dedup:{EventID}:{CorrelationID}`, değer EventID, TTL 24 saat. `CheckDuplication` / `MarkAsProcessed`.
- **Metadata cache:** Key `collector:metadata:{service}:{version}:{environment}`. `CachedMetadata` (ServiceID, Environment, Version, Attributes, CachedAt) JSON olarak saklanır; TTL config’teki `RedisTTL`.
- **Batch counter:** Key `collector:batch_count:{service}`. Her başarılı flush’ta artırılır; `IncrementBatchCounter` / `GetBatchCounter`. Expire 1 saat.
- **Config cache:** Key `collector:config:{key}`. İsteğe bağlı runtime konfigürasyonu.

Health: `HealthCheck()` -> `client.Ping(ctx)`.

Bağlantı: `redis.ParseURL(cfg.RedisURL)`, üzerine password, DB, pool size, min idle, max retries ayarlanır.

---

## A.8 Elasticsearch

Dosya: `golang/internal/collector/storage/elasticsearch.go`.

- **İstemci:** `elasticsearch.NewClient(Addresses: [cfg.ElasticsearchURL])`. Başlangıçta `Info()` ile bağlantı testi.
- **Index adı:** `getIndexName(event)` -> `logs-{service}-{YYYY-MM}` (örn. `logs-user-service-2024-07`). Service boşsa `logs-default`.
- **Bulk API:** `BulkIndexLogEvents` içinde her event için meta satırı (`_index`, `_id`: EventID) ve event gövdesi yazılır; `Refresh: "false"` ile performans tercih edilir.
- **Hata:** Bulk yanıtında `errors: true` ise item bazlı hata mesajları parse edilip döndürülür.

Collector main’de her mesaj için tek event’lik bir slice ile `BulkIndexLogEvents` ayrı goroutine’de çağrılır; ES hatası sadece log’a yazılır, RabbitMQ mesajı yine ack’lenir.

---

## A.9 Metrikler ve Health

Dosya: `golang/internal/collector/metrics/server.go`.

- **Server:** Tek HTTP server; adres `:{MetricsPort}` (varsayılan 9090). Handler: `/metrics` -> Prometheus handler, `/health` -> health handler.

**Prometheus metrikleri (global değişkenler):**

- `collector_messages_processed_total` (Counter)
- `collector_messages_acked_total` (Counter)
- `collector_messages_nacked_total` (Counter)
- `collector_messages_skipped_total` (Counter)
- `collector_db_flush_success_total` / `collector_db_flush_errors_total` (Counter)
- `collector_db_flush_duration_seconds` (Histogram)
- `collector_redis_cache_hits_total` / `collector_redis_cache_misses_total` / `collector_redis_errors_total` (Counter)
- `collector_batch_size_optimized` (Histogram)
- `collector_cache_hit_ratio` (Gauge)
- `collector_batch_processing_time_seconds` (Histogram)

**Health handler:** JSON yanıt: `status: OK`, `service: collector`. Redis client set edilmişse `HealthChecker.HealthCheck()` (Ping) çağrılır; hata varsa `redis: "ERROR: ..."` ve HTTP 503.

---

## A.10 Graceful Shutdown

`main.go` içinde:

- **Sinyal:** `signal.Notify(sigChan, SIGINT, SIGTERM)`.
- Sinyal gelince: 10 saniyelik timeout’lu context ile `metricsServer.Shutdown(shutdownCtx)`; ardından ana context `cancel()`.
- **Consumer:** Aynı context’e bağlı goroutine context iptalinde `consumer.Close()` çağırır; delivery channel kapanır.
- **Worker’lar:** `ctx.Done()` veya `deliveries` kapanınca döngüden çıkar; `wg.Done()` ile sayacı düşürür.
- **Main:** `wg.Wait()` ile tüm worker’ların bitmesini bekler, sonra çıkar.
- **Storage:** `defer dbStorage.Close()`, `defer redisClient.Close()`, `defer esStorage.Close()`, `defer rmqConsumer.Close()` ile kaynaklar kapatılır.

---

## A.11 Bağımlılıklar ve Build

**go.mod (Go 1.22):**

- `github.com/rabbitmq/amqp091-go` – RabbitMQ client
- `github.com/lib/pq` – PostgreSQL driver
- `github.com/elastic/go-elasticsearch/v8` – Elasticsearch client
- `github.com/redis/go-redis/v9` – Redis client
- `github.com/prometheus/client_golang` – Prometheus metrikleri
- `go.uber.org/zap` – Loglama

**Build:** Docker build context `./golang`, Dockerfile `./cmd/collector/Dockerfile`. Çalıştırılabilir `main.go` ile üretilir.

---

# Bölüm B: Proje Geneli (Özet)

## B.1 Proje Özeti

**Observability Hub**, log toplama, metrikler, tracing ve health check ile mikroservis gözlemlenebilirliği sağlar.

- **Node.js mikroservisleri:** user-service, order-service, product-service (Express; log’ları RabbitMQ’ya publish eder).
- **Go Collector:** Yukarıda anlatıldığı gibi log event’lerini tüketir; Postgres, Redis ve Elasticsearch’e yazar; metrik ve health sunar.
- **Altyapı:** PostgreSQL, Redis, RabbitMQ, Elasticsearch, Kibana, Jaeger, Prometheus, Grafana, cAdvisor; hepsi Docker Compose ile ayağa kaldırılabilir.

## B.2 Servisler ve Portlar

| Servis | Port (HTTP/uygulama) | Açıklama |
|--------|----------------------|----------|
| user-service | 8081 | Kullanıcı API, health, metrics |
| order-service | 8080 | Sipariş API, health, metrics |
| product-service | 8082 | Ürün API, health, metrics |
| collector | 9090 | Metrics + health (tek server) |
| collector (Docker expose) | 8083 | Health için expose edilir; uygulama 9090 kullanır |

## B.3 Paylaşılan Observability Paketi

`packages/observability` (TypeScript):

- **Tracing:** Jaeger/OTLP (`initTracer`).
- **Logger:** RabbitMQ’ya log publish (ObservabilityLogger).
- **Redis:** Redis client (rate limiting, health).
- **Health / Readiness:** `createHealthCheckHandler`, `createReadinessCheckHandler`.
- **Middleware:** Correlation ID, error handler, request logging, Prometheus metrics.

user, order ve product servisleri bu paketi kullanır; böylece log formatı, correlation id ve metrikler ortaklaşır.

## B.4 Altyapı

Docker Compose ile tanımlı servisler (özet):

- **Veritabanı:** postgres (obs_postgres), user_service_db, order_service_db, product_service_db.
- **Mesajlaşma:** rabbitmq (obs_rabbitmq).
- **Önbellek:** redis (obs_redis).
- **Arama / log:** elasticsearch (obs_elasticsearch), kibana (obs_kibana).
- **Tracing:** jaeger (obs_jaeger).
- **Metrik / dashboard:** prometheus (obs_prometheus), grafana (obs_grafana), cadvisor, rabbitmq_exporter.
- **Uygulama:** collector (obs_collector), user-service, order-service, product-service.

Tümü `observability` bridge ağında.

## B.5 Çalıştırma

- **Altyapı:** `make up` (docker-compose up, ardından health check).
- **Health:** `make health` (genel), `make health-services` (mikroservisler: 8081, 8080, 8082).
- **Ortam:** Kök `.env` (isteğe bağlı `env.example`’dan); collector için değişkenler docker-compose’da tanımlı.

Collector, `make up` ile diğer altyapı servisleriyle birlikte ayağa kalkar; Postgres, RabbitMQ, Redis ve Elasticsearch healthy olduktan sonra başlar.
