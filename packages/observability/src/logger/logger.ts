import {
  LogClientConfig,
  LogLevel,
  LogMessage,
  LogContext,
  BusinessEvent,
  SecurityEvent,
  PublishResult,
  BatchPublishResult,
  ClientMetrics,
} from './types';
import { createDefaultConfig, FullLogClientConfig } from './config';
import { createInitialMetrics, updateMetrics, getFullMetrics } from './metrics';
import { createCircuitBreaker, CircuitBreaker } from './circuit-breaker';
import { createRabbitMQConnection, RabbitMQConnection } from './connection';
import { createPublisher } from './publisher';

export class ObservabilityLogger {
  private config: FullLogClientConfig;
  private metrics: ClientMetrics;
  private circuitBreaker: CircuitBreaker;
  private connection: RabbitMQConnection;
  private publisher: {
    publishMessage: (
      message: LogMessage,
      options?: import('./types').PublishOptions
    ) => Promise<PublishResult>;
  };
  private batchTimer?: NodeJS.Timeout;

  constructor(config: LogClientConfig) {
    this.config = createDefaultConfig(config);
    this.metrics = createInitialMetrics();
    this.circuitBreaker = createCircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerTimeout
    );
    this.connection = createRabbitMQConnection(this.config, () =>
      this.connect()
    );
    this.publisher = createPublisher(
      this.config,
      this.connection,
      this.circuitBreaker
    );
  }

  public async connect(): Promise<void> {
    await this.connection.connect();
    this.metrics.connectionStatus = this.connection.isConnected
      ? 'connected'
      : 'disconnected';
  }

  private async handlePublish(
    message: LogMessage
  ): Promise<PublishResult> {
    const startTime = Date.now();
    const result = await this.publisher.publishMessage(message);
    const publishTime = Date.now() - startTime;
    this.metrics = updateMetrics(this.metrics, publishTime, result.success);
    return result;
  }

  async trace(message: string, context?: LogContext): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.TRACE,
      message,
      context: context || undefined,
    });
  }

  async debug(message: string, context?: LogContext): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.DEBUG,
      message,
      context: context || undefined,
    });
  }

  async info(message: string, context?: LogContext): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.INFO,
      message,
      context: context || undefined,
    });
  }

  async warn(message: string, context?: LogContext): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.WARN,
      message,
      context: context || undefined,
    });
  }

  async error(
    message: string,
    error?: Error,
    context?: LogContext
  ): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.ERROR,
      message,
      context: context || undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack || undefined,
          }
        : undefined,
    });
  }

  async fatal(
    message: string,
    error?: Error,
    context?: LogContext
  ): Promise<PublishResult> {
    return this.handlePublish({
      level: LogLevel.FATAL,
      message,
      context: context || undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack || undefined,
          }
        : undefined,
    });
  }

  async businessEvent(event: BusinessEvent): Promise<PublishResult> {
    return this.handlePublish(
      {
        level: LogLevel.INFO,
        message: `Business Event: ${event.eventType}`,
        metadata: event as unknown as Record<string, unknown>,
      },
    );
  }

  async securityEvent(event: SecurityEvent): Promise<PublishResult> {
    const level =
      event.severity === 'critical' || event.severity === 'high'
        ? LogLevel.ERROR
        : LogLevel.WARN;

    return this.handlePublish(
      {
        level,
        message: `Security Event: ${event.eventType}`,
        metadata: event as unknown as Record<string, unknown>,
      },
    );
  }

  async logBatch(messages: LogMessage[]): Promise<BatchPublishResult> {
    const results = await Promise.all(
      messages.map((message) => this.handlePublish(message))
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return {
      success: failed.length === 0,
      batchId: '', // Batch ID can be generated if needed
      processed: successful.length,
      failed: failed.length,
      timestamp: new Date().toISOString(),
      errors: failed.map((result, index) => ({
        index,
        error: result.error?.message || 'Unknown error',
      })),
    };
  }

  getMetrics(): ClientMetrics {
    return getFullMetrics(
      this.metrics,
      this.circuitBreaker.state,
      this.circuitBreaker.failures,
      this.circuitBreaker.lastFailure,
      this.config.circuitBreakerTimeout
    );
  }

  async close(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    await this.connection.close();
    this.metrics.connectionStatus = 'disconnected';
  }
}
