# Observability Hub – Kazanımlar ve Ödünler

Bu doküman, projeyi profesyonel bir senaryoda değerlendirir: **neye hizmet ettiği**, **neler kazandırdığı** ve **hangi konularda ödün verildiği** özetlenir.

---

## Proje Neye Hizmet Eder?

Observability Hub, **mikroservis mimarisinde gözlemlenebilirlik (observability)** sağlamak için tasarlanmış bir platformdur. Temel amacı:

- **Logları merkezileştirmek:** Uygulama loglarının tek bir boru hattından (RabbitMQ → Collector) geçip PostgreSQL, Redis ve Elasticsearch’e yazılması; böylece tüm servislerin loglarının tek yerden sorgulanabilmesi.
- **Metrik ve izleme altyapısı sunmak:** Prometheus metrikleri, Grafana dashboard’ları, Jaeger ile dağıtık tracing; servis sağlığı ve performansının izlenmesi.
- **Tutarlı bir log/trace formatı kullanmak:** Paylaşılan observability paketi ile correlation ID, log yapısı ve metrik isimlendirmesinin mikroservisler arasında ortak olması.
- **Olay tabanlı (event-driven) log toplama:** Logların mesaj kuyruğu üzerinden asenkron toplanması; üretici servislerin yazma gecikmesi ve hatalarından daha az etkilenmesi.

Bu sayede proje, **production benzeri bir ortamda log, metrik ve trace’e dayalı karar verme, hata ayıklama ve performans analizi** yapılabilmesine hizmet eder. Aynı zamanda **eğitim ve portfolyo** bağlamında mikroservis observability, event-driven mimari ve çok bileşenli sistem tasarımı deneyimi sunar.

---

## Nelerden Kazanım Sağladık?

### 1. Merkezi ve tutarlı loglama

- Tüm servislerin logları aynı şemaya (eventId, correlationId, level, message, source, metadata) yakın bir yapıda; RabbitMQ üzerinden Collector’e, oradan da kalıcı depolara gidiyor.
- **Correlation ID** ile bir isteğin birden fazla serviste izlenebilmesi; hata ayıklama ve incident analizinde tek bir ID ile filtreleme imkânı.
- Paylaşılan **observability paketi** sayesinde log formatı, middleware ve health check mantığı tek yerde; kod tekrarı azalıyor, değişiklikler tek noktadan yayılıyor.

### 2. Çoklu depolama ve kullanım senaryoları

- **PostgreSQL:** İlişkisel sorgular, raporlama, uzun süreli arşiv; batch insert ile yüksek yazma verimi.
- **Elasticsearch:** Full-text arama, Kibana ile log keşfi ve dashboard; index’ler servis ve aya göre (örn. `logs-user-service-2025-03`) ayrılıyor.
- **Redis:** Collector tarafında deduplication ve metadata cache; aynı event’in tekrar yazılması engelleniyor, batch boyutu cache etkisine göre ayarlanabiliyor.

Bu sayede “sadece log depola”nın ötesinde **sorgulama**, **arama** ve **performans optimizasyonu** için farklı araçlar kullanılabiliyor.

### 3. Yüksek verimli log işleme (Go Collector)

- **Worker pool** ile paralel mesaj işleme; batch yazma (PostgreSQL’e `COPY`) ile tek tek insert’e göre daha az round-trip.
- **Exponential backoff** ve **DLQ** ile geçici hatalarda mesaj kaybı azaltılıyor; parse edilemeyen mesajlar Dead Letter Queue’ya düşüyor.
- **Prometheus metrikleri** (processed, acked, nacked, flush duration, cache hit ratio) ile collector’ün kendisi de izlenebiliyor.

Yani sadece “log topla” değil, **ölçeklenebilir ve izlenebilir bir log pipeline** kazanılmış oluyor.

### 4. Operasyonel görünürlük

- Her serviste **health** ve **metrics** endpoint’leri; load balancer veya orchestrator’ın sağlık kontrolü yapabilmesi.
- **Jaeger** ile dağıtık trace; bir isteğin hangi servislerden geçtiği ve nerede zaman harcadığı görülebiliyor.
- **Grafana + Prometheus** ile metriklerin görselleştirilmesi; ileride alarm ve SLO tanımları için zemin hazır.

Bunlar, **canlı sistemde sorun tespiti ve performans analizi** için somut kazanımlar.

### 5. Teknoloji ve mimari deneyimi

- **Event-driven mimari:** Üretici–kuyruk–tüketici modeli, topic exchange, DLQ kavramlarının uygulanması.
- **Çok dilli mimari:** Node.js (API servisleri) + Go (collector); dil seçiminin iş yüküne göre yapılması.
- **Observability stack:** Prometheus, Grafana, Jaeger, Elasticsearch, Kibana’nın birlikte kullanımı.

Proje, bu konularda **pratik kazanım** ve **portfolyo** için hizmet ediyor.

---

## Nelerden Ödün Verdik?

### 1. Karmaşıklık ve operasyonel yük

- **Çok sayıda bileşen:** Postgres (ana + servis DB’leri), Redis, RabbitMQ, Elasticsearch, Kibana, Jaeger, Prometheus, Grafana, Collector, üç mikroservis. Kurulum, konfigürasyon ve bakım maliyeti artıyor.
- **Öğrenme eğrisi:** Yeni bir geliştiricinin tüm stack’i anlaması ve yerel ortamda sorunsuz çalıştırması zaman alabilir.
- **Kaynak kullanımı:** Bellek ve CPU; özellikle Elasticsearch ve birkaç Postgres instance birlikte çalışırken yerel makinede ağır hissedilebilir.

**Ödün:** Basit “tek servis + tek DB” yerine **operasyonel karmaşıklık** kabul edildi; karşılığında merkezi log, metrik ve trace alındı.

### 2. Gecikme ve nihai tutarlılık

- Loglar **senkron değil:** Önce RabbitMQ’ya gidiyor, Collector işliyor, sonra Postgres/ES’e yazılıyor. “Anında her yerde görünür” garantisi yok; **birkaç saniye gecikme** olabilir.
- **Eventual consistency:** Kibana veya Postgres’te sorguladığınızda, az önce üretilen log henüz orada olmayabilir.

**Ödün:** Gerçek zamanlılık ve kesin senkronluk yerine **kabul edilebilir gecikme** ve **eventual consistency** tercih edildi; buna karşılık üretici servisler bloke olmuyor ve kuyruk tampon görevi görüyor.

### 3. Veri çoğaltma ve tutarlılık riski

- Aynı log **Postgres, Redis (dedup key) ve Elasticsearch**’te tutuluyor. Yazma yolları farklı (batch vs. tek tek vs. async); birinde başarı diğerinde hata olabilir.
- Elasticsearch yazma hatası şu an **sadece loglanıyor**; mesaj yine ack’leniyor. Yani **ES’te eksik kayıt** olabilir, Postgres’te ise kayıt olabilir.

**Ödün:** “Tek gerçek kaynak” ve tam tutarlılık yerine **çoklu depolama ve kısmi tutarsızlık riski** kabul edildi; kazanç olarak sorgu senaryosuna göre farklı store kullanılabiliyor.

### 4. Teknoloji kilidi (lock-in) ve bağımlılıklar

- **RabbitMQ, Elasticsearch, Jaeger, Prometheus** gibi özel ürünlere bağımlılık var. İleride değiştirmek (ör. Kafka, başka bir log backend) mimari değişiklik gerektirir.
- **Paylaşılan observability paketi** Node servislerini bu paketin API’sine ve log/trace formatına bağlıyor.

**Ödün:** Mümkün olan en “generic” tasarım yerine **güçlü ama belirli araçlara bağımlı** bir stack seçildi; karşılığında hızlı geliştirme ve zengin özellik seti alındı.

### 5. Güvenlik ve maliyet (production perspektifi)

- Varsayılanlar **geliştirme odaklı:** Zayıf şifreler, TLS yok, auth basit veya yok. Production’da ayrıca hardening, secret yönetimi ve ağ izolasyonu gerekir.
- **Maliyet:** Tam stack’i bulut üzerinde çalıştırmak (ES, RabbitMQ, birden fazla DB) küçük ekipler için pahalı olabilir.

**Ödün:** Proje “production-ready out of the box” iddiası taşımıyor; **eğitim / proof-of-concept / iç gözlemlenebilirlik** için optimize edildi, güvenlik ve maliyet production’da ayrı ele alınacak varsayıldı.

### 6. Bazı servislerde eksik veya mock katmanlar

- **user-service** gerçek DB’ye yazıp okumuyor (mock repository); config’te DB tanımlı olsa da CRUD in-memory. Order ve product servisleri gerçek DB kullanıyor.
- Bu, **observability ve pipeline’ın testi** için yeterli; ancak “tam uçtan uca iş akışı” açısından user tarafında ödün var.

**Ödün:** Tüm servislerde tam domain mantığı yerine **bazı yerlerde sadeleştirme** kabul edildi; odak log/metrik/trace ve collector davranışında.

---

## Özet Tablo

| Alan | Kazanım | Ödün |
|------|---------|------|
| **Mimari** | Merkezi log pipeline, event-driven, çoklu depolama | Çok bileşen, kurulum ve bakım yükü |
| **Veri** | Postgres + ES + Redis ile farklı kullanım senaryoları | Gecikme, eventual consistency, çoğaltma tutarsızlığı riski |
| **Performans** | Batch yazma, worker pool, dedup, cache | Async/eventual; anlık görünürlük garantisi yok |
| **Operasyon** | Health, metrics, tracing, dashboard’lar | Daha fazla servis ve konfigürasyon |
| **Geliştirme** | Ortak paket, tutarlı format, correlation ID | Belirli stack’e ve formata bağımlılık |
| **Güvenlik / Maliyet** | Hızlı geliştirme, yerel/eğitim odaklı | Production için ek hardening ve maliyet |

---

## Sonuç: Proje Neye Hizmet Eder, Neye Hizmet Etmez?

**Hizmet ettiği şeyler:**

- Mikroservis ortamında **log, metrik ve trace’i merkezileştirmek** ve bunlara dayalı **izleme, hata ayıklama ve analiz** yapılabilmesini sağlamak.
- **Event-driven log toplama** ve **ölçeklenebilir collector** ile üretici servislerin bloke olmadan, kuyruk tamponu ile çalışması.
- **Eğitim ve portfolyo:** Observability stack’i, RabbitMQ, Go/Node birlikte kullanımı ve çok bileşenli sistem tasarımı deneyimi.

**Hizmet etmediği / iddia etmediği şeyler:**

- “Kutudan çıkar çalıştır” **production güvenliği** ve **maliyet optimizasyonu**.
- **Anlık, senkron** log görünürlüğü; gecikme ve eventual consistency kabul edilmiş durumda.
- Tüm servislerde **tam domain (iş) mantığı**; user-service örneğinde mock katmanı bilinçli bir sadeleştirme.

Bu kazanımlar ve ödünler, projeyi **gözlemlenebilirlik odaklı bir referans mimari** ve **pratik deneyim alanı** olarak konumlandırır; production’a taşırken güvenlik, maliyet ve tam tutarlılık ihtiyaçları ayrıca ele alınmalıdır.
