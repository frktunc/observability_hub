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
 * Standard error status code mapping
 */
const defaultStatusCodeMapping: Record<string, number> = {
  'ValidationError': 400,
  'CastError': 400,
  'NotFoundError': 404,
  'UnauthorizedError': 401,
  'ForbiddenError': 403,
  'ConflictError': 409,
  'TooManyRequestsError': 429,
  'TimeoutError': 408,
  'PayloadTooLargeError': 413,
  'UnsupportedMediaTypeError': 415,
  'UnprocessableEntityError': 422,
  'InternalServerError': 500,
  'NotImplementedError': 501,
  'BadGatewayError': 502,
  'ServiceUnavailableError': 503,
  'GatewayTimeoutError': 504
};

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
export function errorHandlerMiddleware(options: ErrorHandlerOptions = {}) {
  const {
    includeStackTrace = process.env.NODE_ENV === 'development',
    logErrors = true,
    customLogger,
    statusCodeMapping = {},
    includeDetails = process.env.NODE_ENV !== 'production'
  } = options;

  const combinedStatusMapping = { ...defaultStatusCodeMapping, ...statusCodeMapping };

  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Get correlation ID from request
    const correlationId = req.correlationId || 'unknown';
    
    // Log error if enabled
    if (logErrors) {
      if (customLogger) {
        customLogger(error, req);
      } else {
        console.error(`[${correlationId}] Error in ${req.method} ${req.path}:`, {
          name: error.name,
          message: error.message,
          stack: includeStackTrace ? error.stack : undefined,
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Determine status code
    const statusCode = combinedStatusMapping[error.name] || 500;
    
    // Build error response
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message || 'Internal Server Error',
        type: error.name || 'Error',
        correlationId,
        timestamp: new Date().toISOString()
      }
    };
    
    // Add details in development/debug mode
    if (includeDetails) {
      errorResponse.error.details = {
        stack: includeStackTrace ? error.stack : undefined,
        path: req.path,
        method: req.method,
        statusCode
      };
    }
    
    // Send error response
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Default error handler with standard configuration
 * Use this for most common use cases
 */
export const defaultErrorHandler = errorHandlerMiddleware(); 