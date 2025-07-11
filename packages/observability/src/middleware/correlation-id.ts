import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

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
export function correlationIdMiddleware(options: CorrelationIdOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    headerName = 'x-correlation-id',
    generateIfMissing = true,
    includeInResponse = true,
    generator = uuidv4
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Get correlation ID from headers
    let correlationId = req.headers[headerName] as string;
    
    // Generate new correlation ID if missing and generation is enabled
    if (!correlationId && generateIfMissing) {
      correlationId = generator();
    }
    
    // Add to request object for downstream use
    if (correlationId) {
      req.correlationId = correlationId;
      
      // Add to response headers if enabled
      if (includeInResponse) {
        res.setHeader(headerName, correlationId);
      }
    }
    
    next();
  };
}

/**
 * Default correlation ID middleware with standard configuration
 * Use this for most common use cases
 */
export const defaultCorrelationIdMiddleware = correlationIdMiddleware(); 