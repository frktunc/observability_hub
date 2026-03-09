# Test Senaryosu – Projenin Sorunsuz Çalıştığının Teyidi

Bu doküman, Observability Hub projesinin uçtan uca sorunsuz çalıştığını doğrulamak isteyen bir geliştirici için örnek test senaryosu ve **çıktıları nerede göreceğinizi** (loglar, metrikler, tracing) adım adım anlatır.

---

## Ön koşullar

- Docker ve Docker Compose yüklü
- Proje kökünde `make` kullanılabilir
- İsteğe bağlı: `curl`, `jq` (JSON çıktıları için)

---

## Adım 1: Altyapı ve servisleri başlatma

Tüm altyapı ve mikroservisleri ayağa kaldırın:

```bash
cd /path/to/observability_hub
make up
```

**Beklenen:** Container’lar (postgres, redis, rabbitmq, elasticsearch, jaeger, prometheus, grafana, collector, user-service, order-service, product-service vb.) ayağa kalkar. Sonunda `make health-infra` çalışır; health-check container’ı çalışıp biter. Eğer health-check sizi container içinde bir shell’e bırakırsa terminalde `exit` yazıp çıkın.

**Çıktıyı nerede görürsünüz:** Doğrudan terminalde `make up` çıktısı. Hata varsa aynı terminalde kırmızı/error satırları görünür.

---

## Adım 2: Health check’lerle doğrulama

Servislerin cevap verdiğini teyit edin:

```bash
make health
```

Bu hedef hem altyapıyı (`make health-infra`) hem mikroservisleri (`make health-services`) kontrol eder.

**Mikroservisleri tek tek test etmek için:**

```bash
# User Service (8081)
curl -s http://localhost:8081/health | jq . !!!

# Order Service (8080)
curl -s http://localhost:8080/health | jq .

# Product Service (8082)
curl -s http://localhost:8082/health | jq .

# Collector (metrik ve health tek portta: 9090)
curl -s http://localhost:9090/health | jq .  !!!
```

**Beklenen:** Her biri JSON döner (örn. `status`, `dependencies`, `service` alanları). Collector `/health` örnek: `{"status":"OK","service":"collector","redis":"OK"}`.

**User-service (8081) yanıt vermiyorsa:** user-service `/health` Redis, DB ve RabbitMQ’ya bağlanıp kontrol eder. Rate limiting artık `/health` ve `/metrics` için atlanıyor; yine de yanıt yoksa Redis veya RabbitMQ erişilemiyor/çok yavaş olabilir. Container loglarına bakın: `docker-compose logs --tail=50 user-service`. **Collector (9090)** yanıt vermiyorsa collector container’ının ayağa kalktığını ve Redis’e bağlandığını kontrol edin.

**Çıktıyı nerede görürsünüz:** `curl` çıktısı terminalde. Loglama yapmıyorsanız çıktıyı dosyaya yönlendirebilirsiniz:

```bash
curl -s http://localhost:8081/health | tee /tmp/user-health.json | jq .
```

---

## Adım 3: API çağrıları ile trafik üretme

Log ve trace üretmek için gerçek HTTP istekleri atın. Aşağıdaki çağrılar servislerin RabbitMQ’ya log publish etmesini, collector’ün bu logları tüketip Postgres/Redis/Elasticsearch’e yazmasını tetikler.

### User Service (8081)

```bash
# Kullanıcı listesi
curl -s http://localhost:8081/api/v1/users | jq .

# ID ile kullanıcı (404 testi: var olmayan id)
curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8081/api/v1/users/999 | jq .

# Kullanıcı oluşturma (log + event üretir)
curl -s -X POST http://localhost:8081/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}' | jq .
```

### Order Service (8080)

```bash
# Sipariş listesi
curl -s "http://localhost:8080/api/v1/orders?limit=5" | jq .

# Kök endpoint (servis bilgisi)
curl -s http://localhost:8080/ | jq .
```

### Product Service (8082)

```bash
# Ürün listesi
curl -s "http://localhost:8082/api/v1/products?limit=5" | jq .

# İstatistik endpoint’i (route sırası düzeltmesi sonrası çalışır)
curl -s http://localhost:8082/api/v1/products/stats | jq .

# Kök endpoint
curl -s http://localhost:8082/ | jq .
```

**Beklenen:** 200/201 ve anlamlı JSON body. Hata senaryolarında 400/404 vb. status kodları.

**Çıktıyı nerede görürsünüz:** Yine terminalde `curl` çıktısı. Bu istekler aynı zamanda:

- Servis **stdout/stderr** (container logları)
- **RabbitMQ** üzerinden collector’e giden log mesajları
- Collector işledikten sonra **PostgreSQL** ve **Elasticsearch**

adımlarında izlenebilir; aşağıda detay var.

---

## Adım 4: Logları nerede görürsünüz?

### 4.1 Container logları (stdout/stderr)

Servislerin kendi logları Docker üzerinden izlenir:

```bash
# Tüm servisler
docker-compose logs -f

# Sadece collector (Go, zap logları)
docker-compose logs -f collector

# Sadece user-service
docker-compose logs -f user-service

# Son N satır
docker-compose logs --tail=100 collector
```

**Ne görürsünüz:** Uygulama içinden `logger.Info`, `console.log` vb. çıktılar. Collector için "Worker started", "Successfully flushed logs to the database", "Failed to unmarshal message" gibi satırlar akışı ve hataları gösterir.

**Dosyaya yönlendirme:** Çıktıyı kalıcı tutmak için:

```bash
docker-compose logs --no-color collector > collector.log 2>&1
docker-compose logs --no-color user-service > user-service.log 2>&1
```

### 4.2 RabbitMQ (mesaj sayısı ve kuyruk)

Log event’leri önce RabbitMQ’ya gider. Kuyruğun dolup boşaldığını buradan kontrol edebilirsiniz:

- **UI:** http://localhost:15672 (varsayılan: obs_user / obs_password)
- **Queues** sekmesinde `logs.collector` kuyruğuna bakın: Ready, Unacked mesaj sayıları.
- **Exchanges** sekmesinde `logs.topic` üzerindeki publish/consume oranları.

**Loglama:** RabbitMQ Management API ile mesaj sayılarını script’e alabilirsiniz (ör. curl ile `/api/queues/%2F/logs.collector`). Bu çıktıyı dosyaya yazıp “test öncesi/sonrası” karşılaştırması yapabilirsiniz.

### 4.3 Collector çıktısı

Collector hem **metrik** hem **log** üretir:

- **Metrik:** http://localhost:9090/metrics (Prometheus formatı). Burada `collector_messages_acked_total`, `collector_messages_processed_total`, `collector_db_flush_success_total` gibi sayaçlar işlenen mesaj ve flush sayısını verir.
- **Log:** Yukarıdaki `docker-compose logs -f collector` ile aynı çıktı; burada “flushed”, “duplicate”, “unmarshal” gibi mesajları izleyebilirsiniz.

Test sonrası metrikleri dosyaya almak için:

```bash
curl -s http://localhost:9090/metrics | grep collector_ > collector-metrics.txt
```

---

## Adım 5: PostgreSQL’de log kayıtları

Collector, log event’lerini `observability_db` içindeki `logs` tablosuna yazar (ana Postgres container: obs_postgres). Kayıtların geldiğini doğrulamak için:

```bash
# Container içinde psql (şifre: ortam değişkeniniz veya obs_password)
docker-compose exec postgres psql -U obs_user -d observability_db -c "
  SELECT event_id, correlation_id, service, level, message, timestamp
  FROM logs
  ORDER BY timestamp DESC
  LIMIT 10;
"
```

**Beklenen:** Adım 3’te yaptığınız API çağrılarından üretilen log satırları (service: user-service, order-service, product-service; level: INFO vb.).

**Çıktıyı nerede loglamak:** Aynı sorguyu `-o dosya` veya shell yönlendirmesi ile dosyaya yazabilirsiniz:

```bash
docker-compose exec -T postgres psql -U obs_user -d observability_db -t -A -c "
  SELECT event_id, service, level, left(message,80) FROM logs ORDER BY timestamp DESC LIMIT 20;
" > postgres-logs-sample.txt
```

---

## Adım 6: Elasticsearch ve Kibana’da loglar

Collector her log event’ini Elasticsearch’e de yazar. Index adı: `logs-{service}-{YYYY-MM}` (örn. `logs-user-service-2025-03`).

**Elasticsearch’te index kontrolü:**

```bash
# Index listesi
curl -s http://localhost:9200/_cat/indices/logs-*?v

# Son birkaç doküman (örnek: user-service)
curl -s "http://localhost:9200/logs-user-service-*/_search?size=3&sort=timestamp:desc&pretty"
```

**Kibana’da görüntüleme:**

1. Tarayıcıda http://localhost:5601 açın.
2. **Stack Management** → **Index Patterns** → Create index pattern: `logs-*`, time field: `timestamp`.
3. **Discover**’da bu pattern’i seçin; zaman aralığını “Last 15 minutes” veya test yaptığınız aralığa ayarlayın.
4. `message`, `service`, `level`, `correlationId` alanlarıyla filtreleyebilirsiniz.

**Çıktıyı nerede loglamak:** Discover’da “Share” → “CSV Reports” veya “Generate CSV” ile rapor alabilirsiniz. Komut satırı için Elasticsearch `_search` çıktısını dosyaya yönlendirin:

```bash
curl -s "http://localhost:9200/logs-user-service-*/_search?size=50&sort=timestamp:desc&pretty" > es-logs-sample.json
```

---

## Adım 7: Prometheus ve Grafana metrikleri

**Prometheus:** Metrikleri scrape eder. UI: http://localhost:9091 (host portu; container içi 9090).

- **Status** → **Targets:** Tüm scrape target’ların “UP” olması gerekir.
- **Graph** sekmesinde örnek sorgular:
  - `collector_messages_acked_total` (collector’ün işlediği mesaj sayısı)
  - `http_requests_total` (mikroservislerden gelen HTTP istek sayıları, route/method/status’e göre)

**Grafana:** http://localhost:3001 (varsayılan GRAFANA_PORT; container 3000). Giriş genelde admin/admin.

- **Data sources:** Prometheus zaten ekli olmalı (URL: prometheus:9090 veya compose’daki tanım).
- Hazır dashboard’lar varsa “Collector” veya “Observability” ile arayın; yoksa yeni panel ekleyip `collector_*`, `http_request_*` metrikleriyle grafik oluşturabilirsiniz.

**Çıktıyı nerede loglamak:** Prometheus metriklerini düzenli almak için:

```bash
curl -s http://localhost:9091/api/v1/query?query=collector_messages_acked_total > prometheus-collector-metrics.json
```

Test öncesi/sonrası bu dosyayı karşılaştırarak mesaj sayısı artışını teyit edebilirsiniz.

---

## Adım 8: Jaeger’da tracing

user-service Jaeger/OTLP ile trace gönderir. Order ve product servisleri de observability paketi kullanıyorsa trace’ler görünebilir.

1. Tarayıcıda http://localhost:16686 (Jaeger UI) açın.
2. **Service** olarak örn. `user-service` seçin.
3. **Find Traces** ile son trace’lere bakın.
4. Bir trace’e tıklayarak span’leri ve süreleri inceleyin.

**Çıktıyı nerede loglamak:** Jaeger API (varsayılan kurulumda erişilebilir ise) veya UI’dan “JSON” export ile trace’leri dosyaya kaydedebilirsiniz. Günlük doğrulama için UI’da “Service” ve “Operation” filtreleri yeterlidir.

---

## Özet: Çıktıları nereye loglamak / nasıl takip etmek

| Ne | Nerede görürsünüz | Dosyaya nasıl alırsınız |
|----|--------------------|--------------------------|
| Servis health | `curl localhost:PORT/health` | `curl ... \| tee health.json` |
| Uygulama logları | `docker-compose logs -f SERVICE` | `docker-compose logs --no-color SERVICE > service.log 2>&1` |
| RabbitMQ kuyruk durumu | http://localhost:15672 Queues | API: `curl -u obs_user:obs_password http://localhost:15672/api/queues/%2F/logs.collector` |
| Collector metrikleri | http://localhost:9090/metrics | `curl -s http://localhost:9090/metrics \| grep collector_ > metrics.txt` |
| PostgreSQL log kayıtları | `psql` ile `logs` tablosu | `docker-compose exec -T postgres psql ... -c "SELECT ..." > logs.csv` |
| Elasticsearch logları | Kibana Discover veya `_search` | `curl "http://localhost:9200/logs-*/_search?..." > es.json` |
| Prometheus metrikleri | http://localhost:9091 + Grafana | `curl "http://localhost:9091/api/v1/query?query=..." > prom.json` |
| Trace’ler | Jaeger UI http://localhost:16686 | UI’dan JSON export veya Jaeger API |

---

## Hızlı doğrulama script’i (opsiyonel)

Tüm kritik endpoint’lerin cevap verdiğini tek seferde kontrol etmek için:

```bash
#!/bin/bash
set -e
echo "=== Health ==="
for port in 8081 8080 8082 9090; do
  echo -n "Port $port: "
  curl -sf "http://localhost:$port/health" > /dev/null && echo "OK" || echo "FAIL"
done
echo "=== Sample API ==="
curl -sf http://localhost:8081/api/v1/users | jq -e '.success == true' && echo "User API OK"
curl -sf "http://localhost:8080/api/v1/orders?limit=1" | jq -e '.orders != null' && echo "Order API OK"
curl -sf "http://localhost:8082/api/v1/products?limit=1" | jq -e '.products != null' && echo "Product API OK"
echo "=== Collector metrics ==="
curl -sf http://localhost:9090/metrics | grep -q collector_messages_processed_total && echo "Collector metrics OK"
echo "Done."
```

Bu script’i `docs/scripts/quick-verify.sh` olarak kaydedip `chmod +x` ile çalıştırabilirsiniz; çıktıyı `./quick-verify.sh | tee verify.log` ile hem ekranda hem dosyada görebilirsiniz.

---

Bu senaryoyu sırayla uygulayarak altyapının, servislerin, collector’ün, veritabanının, Elasticsearch’ün ve metrik/trace araçlarının birlikte sorunsuz çalıştığını teyit edebilir; log ve metrik çıktılarını yukarıdaki tabloya göre istediğiniz yere kaydedebilirsiniz.
