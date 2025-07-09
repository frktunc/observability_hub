import { connect, Connection, Channel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { 
  LogClientConfig, 
  LogLevel, 
  LogMessage, 
  LogContext, 
  BusinessEvent, 
  SecurityEvent,
  PublishResult,
  PublishOptions,
  BatchLogRequest,
  BatchPublishResult,
  ClientMetrics,
  CircuitBreakerState,
  CircuitBreakerMetrics
} from './types';

export class ObservabilityLogger {
  private connection: any = null;
  private channel: any = null;
  private config: Required<Omit<LogClientConfig, 'rabbitmqUsername' | 'rabbitmqPassword' | 'rabbitmqUrl'>> & {
    rabbitmqUrl?: string;
    rabbitmqUsername?: string;
    rabbitmqPassword?: string;
  };
  private isConnected = false;
  private reconnectAttempts = 0;
  private metrics: ClientMetrics;
  private circuitBreakerState: CircuitBreakerState = 'CLOSED';
  private circuitBreakerFailures = 0;
  private circuitBreakerLastFailure?: Date;
  private batchQueue: LogMessage[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(config: LogClientConfig) {
    // Set default configuration
    this.config = {
      ...config,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: config.environment || 'development',
      rabbitmqHostname: config.rabbitmqHostname || 'obs_rabbitmq',
      rabbitmqPort: config.rabbitmqPort || 5672,
      rabbitmqVhost: config.rabbitmqVhost || '/',
      rabbitmqExchange: config.rabbitmqExchange || 'logs.topic',
      connectionTimeout: config.connectionTimeout || 30000,
      heartbeat: config.heartbeat || 60,
      maxRetries: config.maxRetries || 5,
      retryDelayMs: config.retryDelayMs || 2000,
      defaultLogLevel: config.defaultLogLevel || LogLevel.INFO,
      enableBatching: config.enableBatching || false,
      batchSize: config.batchSize || 100,
      batchTimeoutMs: config.batchTimeoutMs || 5000,
      enableCircuitBreaker: config.enableCircuitBreaker || true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
    };

    this.metrics = {
      messagesPublished: 0,
      messagesFailed: 0,
      messagesConfirmed: 0,
      connectionStatus: 'disconnected',
      averagePublishTime: 0,
    };

    // Auto-connect
    this.connect().catch(console.error);
  }

  // Connection management
  private async connect(): Promise<void> {
    try {
      const {
        rabbitmqHostname,
        rabbitmqPort,
        rabbitmqUsername,
        rabbitmqPassword,
        rabbitmqVhost,
        heartbeat,
        connectionTimeout,
      } = this.config;
  
      const connOptions = {
        protocol: 'amqp',
        hostname: rabbitmqHostname,
        port: rabbitmqPort,
        username: rabbitmqUsername,
        password: rabbitmqPassword,
        vhost: rabbitmqVhost,
        heartbeat: heartbeat,
        timeout: connectionTimeout,
      };

      this.connection = await connect(connOptions);

      this.channel = await this.connection.createChannel();
      
      // Ensure exchange exists
      if (this.channel) {
        await this.channel.assertExchange(
          this.config.rabbitmqExchange, 
          'topic', 
          { durable: true }
        );
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.metrics.connectionStatus = 'connected';

      // Setup connection error handlers
      if (this.connection) {
        this.connection.on('error', this.handleConnectionError.bind(this));
        this.connection.on('close', this.handleConnectionClose.bind(this));
      }

      console.log(`[ObservabilityLogger] Connected to RabbitMQ: ${this.config.serviceName}`);
    } catch (error) {
      console.error('[ObservabilityLogger] Connection failed:', error);
      this.metrics.connectionStatus = 'disconnected';
      
      if (this.reconnectAttempts < this.config.maxRetries) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.config.retryDelayMs * this.reconnectAttempts);
      }
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('[ObservabilityLogger] Connection error:', error);
    this.isConnected = false;
    this.metrics.connectionStatus = 'reconnecting';
  }

  private handleConnectionClose(): void {
    console.log('[ObservabilityLogger] Connection closed, attempting to reconnect...');
    this.isConnected = false;
    this.metrics.connectionStatus = 'reconnecting';
    this.connect().catch(console.error);
  }

  // Circuit breaker
  private isCircuitBreakerOpen(): boolean {
    if (!this.config.enableCircuitBreaker) return false;
    
    if (this.circuitBreakerState === 'OPEN') {
      const timeSinceLastFailure = this.circuitBreakerLastFailure 
        ? Date.now() - this.circuitBreakerLastFailure.getTime()
        : 0;
      
      if (timeSinceLastFailure > this.config.circuitBreakerTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        this.circuitBreakerFailures = 0;
      }
    }
    
    return this.circuitBreakerState === 'OPEN';
  }

  private recordCircuitBreakerSuccess(): void {
    if (this.circuitBreakerState === 'HALF_OPEN') {
      this.circuitBreakerState = 'CLOSED';
      this.circuitBreakerFailures = 0;
    }
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = new Date();
    
    if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState = 'OPEN';
    }
  }

  // Core publishing method
  private async publishMessage(
    message: LogMessage, 
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const startTime = Date.now();
    const messageId = options.messageId || uuidv4();

    if (this.isCircuitBreakerOpen()) {
      const error = new Error('Circuit breaker is OPEN');
      this.metrics.messagesFailed++;
      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error,
      };
    }

    if (!this.isConnected || !this.channel) {
      const error = new Error('RabbitMQ connection not available');
      this.metrics.messagesFailed++;
      this.recordCircuitBreakerFailure();
      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error,
      };
    }

    try {
      const routingKey = options.routingKey || this.getRoutingKeyForLogLevel(message.level);
      
      const enrichedMessage = {
        ...message,
        correlationId: message.correlationId || options.correlationId || uuidv4(),
        timestamp: new Date().toISOString(),
        source: {
          service: this.config.serviceName,
          version: this.config.serviceVersion,
          host: process.env.HOSTNAME || 'unknown',
          environment: this.config.environment,
        },
      };

      const publishOptions = {
        persistent: options.persistent ?? true,
        messageId,
        timestamp: Date.now(),
        correlationId: enrichedMessage.correlationId,
        headers: {
          ...options.headers,
          'x-producer': this.config.serviceName,
          'x-publish-time': new Date().toISOString(),
        },
        ...options,
      };

      const buffer = Buffer.from(JSON.stringify(enrichedMessage));
      
      await this.channel.publish(
        this.config.rabbitmqExchange,
        routingKey,
        buffer,
        publishOptions
      );

      const publishTime = Date.now() - startTime;
      this.updateMetrics(publishTime, true);
      this.recordCircuitBreakerSuccess();

      return {
        success: true,
        messageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const publishTime = Date.now() - startTime;
      this.updateMetrics(publishTime, false);
      this.recordCircuitBreakerFailure();

      return {
        success: false,
        messageId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private getRoutingKeyForLogLevel(level: LogLevel): string {
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

  private updateMetrics(publishTime: number, success: boolean): void {
    if (success) {
      this.metrics.messagesPublished++;
      this.metrics.messagesConfirmed++;
    } else {
      this.metrics.messagesFailed++;
    }

    // Update average publish time
    this.metrics.averagePublishTime = 
      (this.metrics.averagePublishTime + publishTime) / 2;
    
    this.metrics.lastMessageTimestamp = new Date().toISOString();
  }

  // Public logging methods
  async trace(message: string, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.TRACE,
      message,
      context: context || undefined,
    });
  }

  async debug(message: string, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.DEBUG,
      message,
      context: context || undefined,
    });
  }

  async info(message: string, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.INFO,
      message,
      context: context || undefined,
    });
  }

  async warn(message: string, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.WARN,
      message,
      context: context || undefined,
    });
  }

  async error(message: string, error?: Error, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.ERROR,
      message,
      context: context || undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack || undefined,
      } : undefined,
    });
  }

  async fatal(message: string, error?: Error, context?: LogContext): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.FATAL,
      message,
      context: context || undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack || undefined,
      } : undefined,
    });
  }

  // Business and security events
  async businessEvent(event: BusinessEvent): Promise<PublishResult> {
    return this.publishMessage({
      level: LogLevel.INFO,
      message: `Business Event: ${event.eventType}`,
      metadata: event as unknown as Record<string, unknown>,
    }, {
      routingKey: 'events.business',
    });
  }

  async securityEvent(event: SecurityEvent): Promise<PublishResult> {
    const level = event.severity === 'critical' || event.severity === 'high' 
      ? LogLevel.ERROR 
      : LogLevel.WARN;

    return this.publishMessage({
      level,
      message: `Security Event: ${event.eventType}`,
      metadata: event as unknown as Record<string, unknown>,
    }, {
      routingKey: 'events.security',
    });
  }

  // Batch processing
  async logBatch(messages: LogMessage[]): Promise<BatchPublishResult> {
    const batchId = uuidv4();
    const results: PublishResult[] = [];
    
    for (const message of messages) {
      const result = await this.publishMessage(message);
      results.push(result);
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      success: failed.length === 0,
      batchId,
      processed: successful.length,
      failed: failed.length,
      timestamp: new Date().toISOString(),
      errors: failed.map((result, index) => ({
        index: results.indexOf(result),
        error: result.error?.message || 'Unknown error',
      })),
    };
  }

  // Utility methods
  getMetrics(): ClientMetrics {
    return {
      ...this.metrics,
      circuitBreaker: {
        state: this.circuitBreakerState,
        failures: this.circuitBreakerFailures,
        successes: this.metrics.messagesConfirmed,
        totalRequests: this.metrics.messagesPublished + this.metrics.messagesFailed,
        lastFailureTime: this.circuitBreakerLastFailure,
        nextAttemptTime: this.circuitBreakerState === 'OPEN' && this.circuitBreakerLastFailure
          ? new Date(this.circuitBreakerLastFailure.getTime() + this.config.circuitBreakerTimeout)
          : undefined,
      },
    };
  }

  async close(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.isConnected = false;
    this.metrics.connectionStatus = 'disconnected';
  }
}
