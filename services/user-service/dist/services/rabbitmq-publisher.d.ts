import { LogMessage } from '@/types/events';
export interface PublishOptions {
    routingKey?: string;
    persistent?: boolean;
    expiration?: number;
    priority?: number;
    headers?: Record<string, unknown>;
    correlationId?: string;
    replyTo?: string;
    messageId?: string;
}
export interface PublishResult {
    success: boolean;
    messageId: string;
    timestamp: string;
    error?: Error;
}
export interface ConnectionMetrics {
    isConnected: boolean;
    connectionCount: number;
    channelCount: number;
    messagesPublished: number;
    messagesConfirmed: number;
    messagesFailed: number;
    reconnectAttempts: number;
    lastReconnectTime?: Date;
    averagePublishTime: number;
}
export declare class RabbitMQPublisher {
    private connection;
    private channels;
    private isConnecting;
    private reconnectTimer;
    private circuitBreaker;
    private metrics;
    private publishTimes;
    constructor();
    private setupCircuitBreakerEvents;
    initialize(): Promise<void>;
    private connect;
    private setupConnectionEvents;
    private handleConnectionLoss;
    private scheduleReconnect;
    private createChannels;
    private getRoutingKeyForLogLevel;
    private publishToRabbitMQ;
    private updateMetrics;
    publishLog(message: LogMessage, options?: PublishOptions): Promise<PublishResult>;
    publishBatch(messages: LogMessage[], batchOptions?: PublishOptions): Promise<PublishResult[]>;
    getMetrics(): ConnectionMetrics;
    isHealthy(): boolean;
    shutdown(): Promise<void>;
}
export declare const rabbitMQPublisher: RabbitMQPublisher;
//# sourceMappingURL=rabbitmq-publisher.d.ts.map