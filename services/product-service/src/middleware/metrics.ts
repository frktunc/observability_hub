import { Request, Response, NextFunction } from 'express';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Simple metrics tracking
  const startTime = Date.now();
  
  // Track request metrics
  const method = req.method;
  const path = req.route?.path || req.path;
  
  // Log basic metrics
  console.log(`[METRICS] ${method} ${path} - ${Date.now() - startTime}ms`);
  
  next();
}; 