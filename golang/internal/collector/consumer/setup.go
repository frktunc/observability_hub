package consumer

import (
	"fmt"
	"observability_hub/golang/internal/collector/config"

	amqp "github.com/rabbitmq/amqp091-go"
)

// setupTopology, consumer'ın çalışması için gereken Yönlendirici (Exchange) ve Kuyruk (Queue) yapılandırmalarını başlatır ve birbirine bağlar.
func setupTopology(ch *amqp.Channel, cfg *config.Config) error {
	// 1. Önce mesajları yönlendiren yapıları (Exchanges) oluştur
	if err := declareExchanges(ch, cfg); err != nil {
		return err
	}
	// 2. Daha sonra kuyrukları oluştur ve bu yönlendiricilere bağla (Bind)
	if err := declareQueuesAndBind(ch, cfg); err != nil {
		return err
	}
	return nil
}

// declareExchanges, Ana yönlendiriciyi ve Hatalı işlenen/düşen mesajların gideceği Ölü Mesaj Yönlendiricisini (Dead Letter Exchange - DLX) ayarlar.
func declareExchanges(ch *amqp.Channel, cfg *config.Config) error {
	// Ana Exchange tanımlaması
	// Tipi "topic" seçilerek, "logs.error" veya "logs.info" gibi konuya dayalı (routing key'e göre) esnek filtreleme yapılabilmesi sağlanır.
	err := ch.ExchangeDeclare(
		cfg.ExchangeName, // Yönlendirici adı
		"topic",          // Yönlendirici tipi
		true,             // durable: true. RabbitMQ yeniden başlasa bile bu yönlendirici kaybolmaz/silinmez.
		false,            // auto-deleted: false. Bağlı bir kuyruk kalmadığında otomatik silinmesin.
		false,            // internal: false. Dışarıdan doğrudan yayın (publish) yapılabilir.
		false,            // no-wait: false. RabbitMQ sunucusundan işlemin kurulduğuna dair onay bekle.
		nil,              // Ek argümanlar
	)
	if err != nil {
		return fmt.Errorf("failed to declare main exchange: %w", err)
	}

	// Hatalı veya işlenemeyen mesajların yönlendirileceği Dead Letter Exchange (DLX) tanımlaması
	// Mesaj hata aldığında (Reject) doğrudan bu Exchange'e düşeceği için tipi "direct" olarak tanımlanır.
	err = ch.ExchangeDeclare(
		cfg.DLXName, // DLX adı
		"direct",    // Yönlendirici tipi
		true,        // durable: true. Kalıcıdır.
		false,       // auto-deleted
		false,       // internal
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLX: %w", err)
	}

	return nil
}

// declareQueuesAndBind, Ana kuyruğu ve Hata kuyruğunu (DLQ) oluşturur, ve bunları demin kurduğumuz yönlendiricilere (Exchange) bağlar.
func declareQueuesAndBind(ch *amqp.Channel, cfg *config.Config) error {
	// Ölü Mesaj Kuyruğu (Dead Letter Queue - DLQ) tanımlaması
	// İşlenemeyen mesajlar bu kuyrukta hapsolur, böylece veri kaybetmeyiz. Daha sonra buradan incelenebilir.
	_, err := ch.QueueDeclare(
		cfg.DLQName, // Kuyruk adı
		true,        // durable: true. Mesajlar ve kuyruk diskte saklanır, restart'ta kaybolmaz.
		false,       // delete when unused: false. Kuyruğa kimse bağlı olmasa bile silinmez.
		false,       // exclusive: false. Diğer istemciler de bağlanabilir.
		false,       // no-wait
		nil,         // Ek argümanlar
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLQ: %w", err)
	}

	// Hata kuyruğunu (DLQ), Hata yönlendiricisine (DLX) bağlıyoruz (Binding)
	err = ch.QueueBind(
		cfg.DLQName, // Bağlanacak kuyruk
		"",          // Yönlendirme anahtarı (routing key) boş, çünkü "direct" tipteki DLX'te mesaja özel değil kuyruğa özel yönlendirme olacak.
		cfg.DLXName, // Bağlanılacak Exchange
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to bind DLQ to DLX: %w", err)
	}

	// Ana kuyruk argümanlarını hazırlıyoruz.
	// RabbitMQ'ya bir komut veriyoruz: "Eğer bir mesaj bu kuyrukta başarısız olursa veya reddedilirse (Nack/Reject), bu mesajı al ve x-dead-letter-exchange'e yolla".
	args := amqp.Table{
		"x-dead-letter-exchange": cfg.DLXName,
	}

	// Ana kuyruğun tanımlanması
	_, err = ch.QueueDeclare(
		cfg.QueueName, // Ana Kuyruk adı
		true,          // durable: true. Kalıcıdır.
		false,         // delete when unused
		false,         // exclusive
		false,         // no-wait
		args,          // Argümanlar (Burada Dead Letter Exchange kuralı kuyruğa bağlanmış oldu)
	)
	if err != nil {
		return fmt.Errorf("failed to declare main queue: %w", err)
	}

	// Ana kuyruğu, Ana yönlendiriciye (Main Exchange) "logs.#" kalıbı ile (routing_key pattern) bağlıyoruz.
	// "logs.#" ifadesi örneğin "logs.error", "logs.warning", "logs.auth.failed" gibi "logs." ile başlayan tüm mesaj kategorilerini bu kuyruğa düşürür.
	err = ch.QueueBind(
		cfg.QueueName,    // Bağlanacak kuyruk
		"logs.#",         // Routing key patterni (# işareti 0 veya daha çok kelimeyi ifade eder)
		cfg.ExchangeName, // Bağlanılacak Exchange
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to bind main queue to exchange: %w", err)
	}

	return nil
}
