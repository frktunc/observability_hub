package consumer

import (
	"context"
	"fmt"
	"log"
	"observability_hub/golang/internal/collector/config"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Consumer, RabbitMQ ile iletişim kurmak için gerekli bağlantı ve kanal bilgilerini tutar.
type Consumer struct {
	conn    *amqp.Connection // RabbitMQ sunucusuna olan ana bağlantı
	channel *amqp.Channel    // Mesaj alıp göndermek için kullanılan iletişim kanalı
	cfg     *config.Config   // Kuyruk ve Exchange isimleri gibi yapılandırma ayarları
}

// New, yapılandırma (config) bilgilerini kullanarak yeni bir RabbitMQ tüketicisi (consumer) oluşturur.
func New(cfg *config.Config) (*Consumer, error) {
	// 1. Adım: RabbitMQ sunucusuna bağlantı açıyoruz
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	// 2. Adım: Bu bağlantı üzerinden bir iletişim kanalı oluşturuyoruz
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open a channel: %w", err)
	}

	// 3. Adım: Exchange ve Kuyruk tanımlamalarını (topoloji) ayırılmış fonksiyonda yapıyoruz
	err = setupTopology(ch, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to setup rabbitmq topology: %w", err)
	}

	// Kurulum başarılıysa Consumer nesnemizi döndürüyoruz
	return &Consumer{
		conn:    conn,
		channel: ch,
		cfg:     cfg,
	}, nil
}

// Start, RabbitMQ'dan mesajları dinlemeye başlar.
// İşçilerin (workers) işlemesi için akış halindeki mesajları içeren bir Go kanalı (<-chan) döndürür.
func (c *Consumer) Start(ctx context.Context) (<-chan amqp.Delivery, error) {
	// Belirtilen kuyruktan mesajları tüketmek için kayıt oluyoruz
	msgs, err := c.channel.Consume(
		c.cfg.QueueName, // Dinlenecek kuyruğun adı
		"",              // Consumer etiketi (boş bırakılırsa RabbitMQ otomatik atar)
		false,           // auto-ack (otomatik onay): false. Mesajların başarıyla işlendiğini biz manuel olarak bildireceğiz (veri kaybını önler).
		false,           // exclusive: false. Bu kuyruğu başka consumer'lar (örneğin uygulamayı scale ettiğimizde) kullanabilsin.
		false,           // no-local: false. Sunucunun kendi gönderdiği mesajları almasını engellemez.
		false,           // no-wait: false. İşlemin tamamlanması için RabbitMQ'dan onay bekle.
		nil,             // Ek argümanlar.
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register a consumer: %w", err)
	}

	// Uygulama kapatıldığında (Context sonlandığında) bağlantıları temiz bir şekilde kapatmak için arka planda bir dinleyici başlatıyoruz
	go func() {
		<-ctx.Done()
		log.Println("Shutting down consumer...")
		c.Close()
	}()

	return msgs, nil
}

// Close, RabbitMQ ile olan kanalı ve ana bağlantıyı güvenli ve duyarlı bir şekilde kapatır.
// Kaynak sızıntılarını (resource leak) önlemek için uygulama kapanırken veya hata durumunda çağrılmalıdır.
func (c *Consumer) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
