package consumer

import (
	"context"
	"fmt"
	"log"
	"observability_hub/golang/internal/collector/config"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Consumer holds the necessary components for a RabbitMQ consumer.
type Consumer struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	cfg     *config.Config
}

// New creates a new RabbitMQ consumer.
func New(cfg *config.Config) (*Consumer, error) {
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open a channel: %w", err)
	}

	// Declare the Dead Letter Exchange
	err = ch.ExchangeDeclare(
		cfg.DLXName, // name
		"direct",    // type
		true,        // durable
		false,       // auto-deleted
		false,       // internal
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare DLX: %w", err)
	}

	// Declare the Dead Letter Queue
	_, err = ch.QueueDeclare(
		cfg.DLQName, // name
		true,        // durable
		false,       // delete when unused
		false,       // exclusive
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare DLQ: %w", err)
	}

	// Bind the DLQ to the DLX
	err = ch.QueueBind(
		cfg.DLQName, // queue name
		"",          // routing key
		cfg.DLXName, // exchange
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to bind DLQ to DLX: %w", err)
	}

	// Declare the main queue with DLX arguments
	args := amqp.Table{
		"x-dead-letter-exchange": cfg.DLXName,
	}
	_, err = ch.QueueDeclare(
		cfg.QueueName, // name
		true,          // durable
		false,         // delete when unused
		false,         // exclusive
		false,         // no-wait
		args,          // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare main queue: %w", err)
	}

	return &Consumer{
		conn:    conn,
		channel: ch,
		cfg:     cfg,
	}, nil
}

// Start consuming messages from RabbitMQ.
// It returns a channel of deliveries for workers to process.
func (c *Consumer) Start(ctx context.Context) (<-chan amqp.Delivery, error) {
	msgs, err := c.channel.Consume(
		c.cfg.QueueName, // queue
		"",              // consumer
		false,           // auto-ack is false. We will manually ack messages.
		false,           // exclusive
		false,           // no-local
		false,           // no-wait
		nil,             // args
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register a consumer: %w", err)
	}

	// Reconnect logic
	go func() {
		<-ctx.Done()
		log.Println("Shutting down consumer...")
		c.Close()
	}()

	return msgs, nil
}

// Close gracefully shuts down the connection and channel.
func (c *Consumer) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
