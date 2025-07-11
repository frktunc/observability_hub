import { LogClientConfig, LogMessage, LogContext, BusinessEvent, SecurityEvent, PublishResult, BatchPublishResult, ClientMetrics } from './types';
export declare class ObservabilityLogger {
    private connection;
    private channel;
    private config;
    private isConnected;
    private reconnectAttempts;
    private metrics;
    private circuitBreakerState;
    private circuitBreakerFailures;
    private circuitBreakerLastFailure?;
    private batchTimer?;
    constructor(config: LogClientConfig);
    private connect;
    private handleConnectionError;
    private handleConnectionClose;
    private isCircuitBreakerOpen;
    private recordCircuitBreakerSuccess;
    private recordCircuitBreakerFailure;
    private publishMessage;
    private getRoutingKeyForLogLevel;
    private updateMetrics;
    trace(message: string, context?: LogContext): Promise<PublishResult>;
    debug(message: string, context?: LogContext): Promise<PublishResult>;
    info(message: string, context?: LogContext): Promise<PublishResult>;
    warn(message: string, context?: LogContext): Promise<PublishResult>;
    error(message: string, error?: Error, context?: LogContext): Promise<PublishResult>;
    fatal(message: string, error?: Error, context?: LogContext): Promise<PublishResult>;
    businessEvent(event: BusinessEvent): Promise<PublishResult>;
    securityEvent(event: SecurityEvent): Promise<PublishResult>;
    logBatch(messages: LogMessage[]): Promise<BatchPublishResult>;
    getMetrics(): ClientMetrics;
    close(): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map