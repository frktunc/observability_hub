import { connect } from 'amqplib';
import { FullLogClientConfig } from './config';

export interface RabbitMQConnection {
  connection: any | null;
  channel: any | null;
  isConnected: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
}

export function createRabbitMQConnection(
  config: FullLogClientConfig,
  onReconnect: () => void
): RabbitMQConnection {
  let connection: any | null = null;
  let channel: any | null = null;
  let isConnected = false;
  let reconnectAttempts = 0;

  async function connectToRabbitMQ(): Promise<void> {
    try {
      const {
        rabbitmqHostname,
        rabbitmqPort,
        rabbitmqUsername,
        rabbitmqPassword,
        rabbitmqVhost,
        heartbeat,
        connectionTimeout,
      } = config;

      const connOptions = {
        protocol: 'amqp',
        hostname: rabbitmqHostname,
        port: rabbitmqPort,
        username: rabbitmqUsername,
        password: rabbitmqPassword,
        vhost: rabbitmqVhost,
        heartbeat,
        timeout: connectionTimeout,
      };

      connection = await connect(connOptions);
      channel = await connection.createChannel();

      if (channel) {
        await channel.assertExchange(config.rabbitmqExchange, 'topic', {
          durable: true,
        });
      }

      isConnected = true;
      reconnectAttempts = 0;

      connection.on('error', handleConnectionError);
      connection.on('close', handleConnectionClose);

      console.log(`[ObservabilityLogger] Connected to RabbitMQ: ${config.serviceName}`);
    } catch (error) {
      console.error('[ObservabilityLogger] Connection failed:', error);
      isConnected = false;
      if (reconnectAttempts < config.maxRetries) {
        reconnectAttempts++;
        setTimeout(connectToRabbitMQ, config.retryDelayMs * reconnectAttempts);
      }
    }
  }

  function handleConnectionError(error: Error): void {
    console.error('[ObservabilityLogger] Connection error:', error);
    isConnected = false;
  }

  function handleConnectionClose(): void {
    console.log('[ObservabilityLogger] Connection closed, attempting to reconnect...');
    isConnected = false;
    onReconnect();
  }

  async function close(): Promise<void> {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    isConnected = false;
  }

  return {
    get connection() {
      return connection;
    },
    get channel() {
      return channel;
    },
    get isConnected() {
      return isConnected;
    },
    connect: connectToRabbitMQ,
    close,
  };
}
