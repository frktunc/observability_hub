import { CircuitBreakerState } from './types';
export interface CircuitBreaker {
    state: CircuitBreakerState;
    failures: number;
    lastFailure?: Date;
    isRequestAllowed(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
}
export declare function createCircuitBreaker(threshold: number, timeout: number): CircuitBreaker;
//# sourceMappingURL=circuit-breaker.d.ts.map