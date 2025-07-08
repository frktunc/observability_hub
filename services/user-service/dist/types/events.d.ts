export declare enum LogLevel {
    TRACE = "TRACE",
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL"
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
export interface LogProducerOptions {
    serviceName: string;
    serviceVersion: string;
    environment: 'development' | 'staging' | 'production';
    enableMetrics?: boolean;
    enableTracing?: boolean;
}
export interface LogMessage {
    level: LogLevel;
    message: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
    context?: {
        userId?: string;
        sessionId?: string;
        requestId?: string;
        operation?: string;
        component?: string;
        [key: string]: unknown;
    };
    error?: {
        name?: string;
        message?: string;
        stack?: string;
        code?: string;
        [key: string]: unknown;
    };
}
export interface BatchLogRequest {
    messages: LogMessage[];
    batchId?: string;
    timestamp?: string;
}
export interface LogResponse {
    success: boolean;
    messageId?: string;
    correlationId?: string;
    timestamp: string;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
export interface BatchLogResponse {
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
export interface ProducerMetrics {
    messagesProduced: number;
    messagesFailedValidation: number;
    messagesFailedPublish: number;
    averageProcessingTime: number;
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    lastMessageTimestamp?: string;
}
export interface LogServiceRequest {
    message: LogMessage;
    options?: {
        timeout?: number;
        retries?: number;
    };
}
export interface LogServiceBatchRequest {
    batch: BatchLogRequest;
    options?: {
        timeout?: number;
        retries?: number;
    };
}
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerMetrics {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    totalRequests: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: {
        rabbitmq: {
            status: 'connected' | 'disconnected' | 'error';
            latency?: number;
            error?: string;
        };
       
        memory: {
            used: number;
            limit: number;
            percentage: number;
        };
    };
    timestamp: string;
    uptime: number;
}
export interface TenantContext {
    tenantId: string;
    permissions?: string[];
    quotas?: {
        messagesPerHour?: number;
        maxMessageSize?: number;
    };
}
export interface TenantAwareLogMessage extends LogMessage {
    tenantId?: string;
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
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
}
export interface RateLimitedRequest {
    clientId: string;
    endpoint: string;
    timestamp: Date;
}
//# sourceMappingURL=events.d.ts.map