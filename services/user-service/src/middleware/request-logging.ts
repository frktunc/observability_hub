import { Request, Response, NextFunction } from 'express';

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Add start time to request
  req.startTime = Date.now();
  
  // Log request start
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
} 