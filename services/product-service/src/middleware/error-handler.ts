import { Request, Response, NextFunction } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';

export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  // Log error with correlation ID
  console.error(`[${correlationId}] Error:`, error);
  
  // Determine status code
  let statusCode = 500;
  if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
  }
  
  // Send error response
  res.status(statusCode).json({
    error: {
      message: error.message || 'Internal Server Error',
      type: error.name || 'Error',
      correlationId,
      timestamp: new Date().toISOString()
    }
  });
}; 