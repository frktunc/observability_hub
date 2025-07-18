import { LogClientConfig, LogMessage, LogContext, BusinessEvent, SecurityEvent, PublishResult, BatchPublishResult, ClientMetrics } from './types';
export declare class ObservabilityLogger {
    private config;
    private metrics;
    private circuitBreaker;
    private connection;
    private publisher;
    private batchTimer?;
    constructor(config: LogClientConfig);
    connect(): Promise<void>;
    private handlePublish;
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