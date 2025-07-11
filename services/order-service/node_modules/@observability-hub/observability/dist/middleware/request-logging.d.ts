import { Request, Response, NextFunction } from 'express';
export interface RequestLoggingOptions {
    /**
     * Whether to log request start
     * @default true
     */
    logRequestStart?: boolean;
    /**
     * Whether to log request completion
     * @default true
     */
    logRequestEnd?: boolean;
    /**
     * Fields to include in request logs
     */
    includeFields?: {
        method?: boolean;
        url?: boolean;
        userAgent?: boolean;
        ip?: boolean;
        correlationId?: boolean;
        statusCode?: boolean;
        duration?: boolean;
        contentLength?: boolean;
    };
    /**
     * Custom logger function
     * If not provided, will use console.log
     */
    customLogger?: (level: 'info' | 'warn' | 'error', message: string, metadata?: any) => void;
    /**
     * Skip logging for certain paths (e.g., health checks)
     */
    skipPaths?: string[];
    /**
     * Skip logging for certain HTTP methods
     */
    skipMethods?: string[];
    /**
     * Log level threshold for response status codes
     */
    statusCodeLogLevels?: {
        [statusCode: number]: 'info' | 'warn' | 'error';
    };
}
declare global {
    namespace Express {
        interface Request {
            startTime?: number;
        }
    }
}
/**
 * Unified request logging middleware for all microservices
 *
 * Features:
 * - Configurable request/response logging
 * - Correlation ID tracking
 * - Performance monitoring (duration)
 * - Flexible field inclusion
 * - Custom logger support
 * - Path/method filtering
 * - Status code-based log levels
 *
 * @param options Configuration options
 * @returns Express middleware function
 */
export declare function requestLoggingMiddleware(options?: RequestLoggingOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Default request logging middleware with standard configuration
 * Use this for most common use cases
 */
export declare const defaultRequestLogging: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Minimal request logging for high-traffic endpoints
 */
export declare const minimalRequestLogging: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=request-logging.d.ts.map