// Types for @observability-hub/log-client library

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG', 
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface EventSource {
  service: string;
  version: string;
  host: string;
  environment: string;
}

export interface BaseEvent {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  correlationId: string;
  source: EventSource;
  metadata?: Record<string, unknown>;
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  tenantId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LogMessage {
  level: LogLevel;
  message: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  context?: LogContext | undefined;
  error?: {
    name?: string;
    message?: string;
    stack?: string | undefined;
    code?: string;
    [key: string]: unknown;
  } | undefined;
}

export interface BusinessEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventVersion: number;
  causationId?: string;
  correlationId: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SecurityEvent {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actor?: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  };
  target?: {
    resource?: string;
    action?: string;
  };
  timestamp: string;
  data: Record<string, unknown>;
}

// Client configuration
export interface LogClientConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  rabbitmqUrl?: string; // Keep for backward compatibility or simple setups
  rabbitmqHostname?: string;
  rabbitmqPort?: number;
  
  // RabbitMQ Configuration
  rabbitmqUsername?: string;
  rabbitmqPassword?: string;
  rabbitmqVhost?: string;
  rabbitmqExchange?: string;
  
  // Connection settings
  connectionTimeout?: number;
  heartbeat?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  
  // Logging settings
  defaultLogLevel?: LogLevel;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeoutMs?: number;
  
  // Performance settings
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

// Publisher options
export interface PublishOptions {
  routingKey?: string;
  correlationId?: string;
  messageId?: string;
  persistent?: boolean;
  priority?: number;
  expiration?: string;
  headers?: Record<string, unknown>;
}

// Batch processing
export interface BatchLogRequest {
  messages: LogMessage[];
  batchId?: string;
  timestamp?: string;
}

// Response types
export interface PublishResult {
  success: boolean;
  messageId: string;
  timestamp: string;
  error?: Error;
}

export interface BatchPublishResult {
  success: boolean;
  batchId: string;
  processed: number;
  failed: number;
  timestamp: string;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// Circuit breaker
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date | undefined;
  nextAttemptTime?: Date | undefined;
}

// Client metrics
export interface ClientMetrics {
  messagesPublished: number;
  messagesFailed: number;
  messagesConfirmed: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastMessageTimestamp?: string;
  averagePublishTime: number;
  circuitBreaker?: CircuitBreakerMetrics;
}
