import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}
export interface CorrelationIdOptions {
    /**
     * Header name to look for existing correlation ID
     * @default 'x-correlation-id'
     */
    headerName?: string;
    /**
     * Whether to generate a new correlation ID if none exists
     * @default true
     */
    generateIfMissing?: boolean;
    /**
     * Whether to include correlation ID in response headers
     * @default true
     */
    includeInResponse?: boolean;
    /**
     * Custom correlation ID generator function
     * @default uuidv4
     */
    generator?: () => string;
}
/**
 * Middleware to handle correlation IDs for request tracing
 *
 * This middleware:
 * - Extracts correlation ID from request headers
 * - Generates a new one if missing (optional)
 * - Adds correlation ID to request object
 * - Includes correlation ID in response headers (optional)
 *
 * @param options Configuration options
 * @returns Express middleware function
 */
export declare function correlationIdMiddleware(options?: CorrelationIdOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Default correlation ID middleware with standard configuration
 * Use this for most common use cases
 */
export declare const defaultCorrelationIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=correlation-id.d.ts.map