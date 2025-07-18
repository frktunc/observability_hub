import { ClientMetrics, CircuitBreakerState } from './types';
export declare function createInitialMetrics(): ClientMetrics;
export declare function updateMetrics(metrics: ClientMetrics, publishTime: number, success: boolean): ClientMetrics;
export declare function getFullMetrics(metrics: ClientMetrics, circuitBreakerState: CircuitBreakerState, circuitBreakerFailures: number, circuitBreakerLastFailure?: Date, circuitBreakerTimeout?: number): {
    circuitBreaker: {
        state: CircuitBreakerState;
        failures: number;
        successes: number;
        totalRequests: number;
        lastFailureTime: Date | undefined;
        nextAttemptTime: Date | undefined;
    };
    messagesPublished: number;
    messagesFailed: number;
    messagesConfirmed: number;
    connectionStatus: "connected" | "disconnected" | "reconnecting";
    lastMessageTimestamp?: string;
    averagePublishTime: number;
};
//# sourceMappingURL=metrics.d.ts.map