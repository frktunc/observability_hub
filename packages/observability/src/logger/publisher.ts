import { v4 as uuidv4 } from 'uuid';
import {
  LogMessage,
  PublishOptions,
  PublishResult,
  LogLevel,
} from './types';
import { RabbitMQConnection } from './connection';
import { CircuitBreaker } from './circuit-breaker';
import { FullLogClientConfig } from './config';

export function createPublisher(
  config: FullLogClientConfig,
  connection: RabbitMQConnection,
  circuitBreaker: CircuitBreaker
) {
  async function publishMessage(
    message: LogMessage,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const messageId = options.messageId || uuidv4();

    if (!circuitBreaker.isRequestAllowed()) {
      const error = new Error('Circuit breaker is OPEN');
      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error,
      };
    }

    if (!connection.isConnected || !connection.channel) {
      const error = new Error('RabbitMQ connection not available');
      circuitBreaker.recordFailure();
      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error,
      };
    }

    try {
      const routingKey =
        options.routingKey || getRoutingKeyForLogLevel(message.level);
      const eventId = uuidv4();
      const timestamp = new Date().toISOString();

      const enrichedMessage = {
        eventId,
        eventType: `log.${message.level.toLowerCase()}.created`,
        version: '1.0.0',
        timestamp,
        correlationId:
          message.correlationId || options.correlationId || uuidv4(),
        source: {
          service: config.serviceName,
          version: config.serviceVersion,
          instance: process.env.HOSTNAME || 'unknown',
          region: process.env.REGION || undefined,
        },
        data: {
          level: message.level,
          message: message.message,
          timestamp,
          context: message.context || undefined,
          structured: message.metadata
            ? { fields: message.metadata }
            : undefined,
          error: message.error || undefined,
        },
        metadata: {
          priority:
            message.level === 'ERROR' || message.level === 'FATAL'
              ? 'high'
              : 'normal',
          tags: [],
          environment: config.environment,
        },
      };

      const publishOptions = {
        persistent: options.persistent ?? true,
        messageId,
        timestamp: Date.now(),
        correlationId: enrichedMessage.correlationId,
        headers: {
          ...options.headers,
          'x-producer': config.serviceName,
          'x-publish-time': new Date().toISOString(),
        },
        ...options,
      };

      const buffer = Buffer.from(JSON.stringify(enrichedMessage));

      await connection.channel.publish(
        config.rabbitmqExchange,
        routingKey,
        buffer,
        publishOptions
      );

      circuitBreaker.recordSuccess();

      return {
        success: true,
        messageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      circuitBreaker.recordFailure();

      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  function getRoutingKeyForLogLevel(level: LogLevel): string {
    const levelMap: Record<LogLevel, string> = {
      [LogLevel.TRACE]: 'logs.debug',
      [LogLevel.DEBUG]: 'logs.debug',
      [LogLevel.INFO]: 'logs.info',
      [LogLevel.WARN]: 'logs.warning',
      [LogLevel.ERROR]: 'logs.error',
      [LogLevel.FATAL]: 'logs.error',
    };
    return levelMap[level] || 'logs.info';
  }

  return { publishMessage };
}
