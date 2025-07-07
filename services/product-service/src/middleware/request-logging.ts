import { Request, Response, NextFunction } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';

export const requestLoggingMiddleware = (logger: ObservabilityLogger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = (req as any).correlationId || 'unknown';
    
    // Log request
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any): any {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId
      });
      
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}; 