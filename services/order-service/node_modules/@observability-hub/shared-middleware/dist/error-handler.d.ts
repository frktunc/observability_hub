import { Request, Response, NextFunction } from 'express';
export interface ErrorResponse {
    error: {
        message: string;
        type: string;
        correlationId: string;
        timestamp: string;
        details?: any;
    };
}
export interface ErrorHandlerOptions {
    /**
     * Whether to include stack trace in development
     * @default true in development, false in production
     */
    includeStackTrace?: boolean;
    /**
     * Whether to log errors to console
     * @default true
     */
    logErrors?: boolean;
    /**
     * Custom error logger function
     */
    customLogger?: (error: Error, req: Request) => void;
    /**
     * Custom error status code mapping
     */
    statusCodeMapping?: Record<string, number>;
    /**
     * Whether to include detailed error information
     * @default false in production
     */
    includeDetails?: boolean;
}
/**
 * Unified error handler middleware for all microservices
 *
 * Features:
 * - Consistent error response format
 * - Correlation ID tracking
 * - Configurable error mapping
 * - Environment-aware error details
 * - Custom logging support
 *
 * @param options Configuration options
 * @returns Express error handler middleware
 */
export declare function errorHandlerMiddleware(options?: ErrorHandlerOptions): (error: Error, req: Request, res: Response, next: NextFunction) => void;
/**
 * Default error handler with standard configuration
 * Use this for most common use cases
 */
export declare const defaultErrorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error-handler.d.ts.map