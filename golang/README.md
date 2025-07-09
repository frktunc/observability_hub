# Go Collector Service

## Genel Bakış

Bu dizin, Gözlemlenebilirlik Merkezi (Observability Hub) projesi için geliştirilen yüksek performanslı ve dayanıklı log toplayıcı (collector) servisinin kaynak kodlarını içerir. Go dilinde yazılan bu servis, RabbitMQ kuyruğundan log olaylarını almaktan, bunları toplu halde (batch) işlemekten ve verimli bir şekilde PostgreSQL veritabanına kaydetmekten sorumludur.

## Temel Özellikler

- **Yüksek Performans:** RabbitMQ'dan gelen mesajları eş zamanlı olarak işlemek için bir worker pool (goroutine havuzu) mimarisi kullanır.
- **Verimli Veritabanı Yazma İşlemleri:** Logları biriktirmek için bir toplu işleme (batching) mekanizması uygular ve yüksek verimli veri ekleme için PostgreSQL'in `COPY FROM` protokolünü kullanır.
- **Dayanıklılık ve Güvenilirlik:**
  - **Yeniden Deneme Mekanizması:** Geçici veritabanı hatalarına karşı `exponential backoff` stratejisi ile bir yeniden deneme mekanizması içerir.
  - **Dead Letter Queue (DLQ):** İşlenemeyen mesajların (örneğin, bozuk JSON) kaybolmamasını ve daha sonra incelenebilmesini sağlamak için RabbitMQ'nun DLQ özelliği ile entegre çalışır.
- **Gözlemlenebilirlik (Observability):**
  - **Yapısal Loglama:** Sorgulanabilir ve yapısal loglar için `zap` kütüphanesini kullanır.
  - **Prometheus Metrikleri:** `/metrics` endpoint'i üzerinden işlenen mesaj sayısı, veritabanı yazma süresi, hatalar gibi detaylı performans metrikleri sunar.
  - **Sağlık Kontrolü:** Servisin durumunu izlemek için basit bir `/health` endpoint'i sağlar.
- **Kontrollü Kapatma (Graceful Shutdown):** `SIGINT` ve `SIGTERM` sinyallerini yakalayarak, uygulamadan çıkmadan önce işlemekte olan tüm verilerin veritabanına yazılmasını sağlar ve kaynakları temiz bir şekilde kapatır.
- **Konteyner Desteği:** Minimal ve güvenli bir üretim imajı oluşturmak için çok aşamalı (multi-stage) bir `Dockerfile` içerir.

## Yapılandırma (Configuration)

Servis tamamen ortam değişkenleri (environment variables) aracılığıyla yapılandırılır. Ana değişkenler projenin kök dizinindeki `docker-compose.yml` dosyasında tanımlanmıştır.

| Ortam Değişkeni | Açıklama | `docker-compose.yml` içindeki Değer |
| --- | --- | --- |
| `RABBITMQ_URL` | RabbitMQ için bağlantı adresi. | `amqp://obs_user:obs_password@rabbitmq:5672/` |
| `POSTGRES_URL` | PostgreSQL için bağlantı adresi. | `postgres://obs_user:obs_password@postgres:5432/observability_db?sslmode=disable` |
| `COLLECTOR_BATCH_SIZE` | Veritabanına yazılmadan önce biriktirilecek mesaj sayısı. | `500` |
| `COLLECTOR_BATCH_TIMEOUT` | Biriktirilen mesajları veritabanına yazmak için maksimum bekleme süresi. | `5s` |
| `COLLECTOR_WORKER_POOL_SIZE`| Mesajları işleyen eş zamanlı worker sayısı. | `20` |
| `COLLECTOR_RETRY_MAX` | Başarısız bir veritabanı işlemi için maksimum yeniden deneme sayısı. | `5` |
| `COLLECTOR_RETRY_INTERVAL` | Yeniden deneme için başlangıç bekleme süresi. | `2s` |
| `METRICS_PORT` | `/metrics` ve `/health` endpoint'leri için sunucu portu. | `9090` |
| `HEALTH_CHECK_PORT` | Sağlık kontrolü için yapılandırılmış ancak şu anki implementasyonda metrik portu kullanılan port. | `8081` |

## Nasıl Çalıştırılır?

Collector servisi, projenin kök dizinindeki ana `docker-compose.yml` dosyasının bir parçası olarak çalıştırılmak üzere tasarlanmıştır.

```bash
# Projenin kök dizininden
docker-compose up --build collector
```

Servis başlayacak, RabbitMQ ve PostgreSQL'e bağlanacak ve mesajları işlemeye başlayacaktır.

- **Metrik Endopoint'i:** `http://localhost:9090/metrics`
- **Sağlık Kontrolü Endpoint'i:** `http://localhost:9090/health` 