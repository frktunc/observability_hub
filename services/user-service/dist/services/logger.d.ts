import winston from 'winston';
export interface LogContext {
    correlationId?: string;
    requestId?: string;
    userId?: string;
    operation?: string;
    component?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
    error?: Error | Record<string, unknown>;
    stack?: string;
    timerId?: string;
    [key: string]: unknown;
}
export interface StructuredLogger {
    trace(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    timeStart(operation: string, context?: LogContext): string;
    timeEnd(timerId: string, message?: string, context?: LogContext): void;
    businessEvent(event: string, data: Record<string, unknown>, context?: LogContext): void;
    securityEvent(event: string, data: Record<string, unknown>, context?: LogContext): void;
    child(persistentContext: LogContext): StructuredLogger;
}
export declare const structuredLogger: StructuredLogger;
export declare const rawLogger: winston.Logger;
export declare const createRequestLogger: (correlationId: string, requestId?: string) => StructuredLogger;
export declare const initializeLogger: () => void;
export declare const shutdownLogger: () => Promise<void>;
//# sourceMappingURL=logger.d.ts.map