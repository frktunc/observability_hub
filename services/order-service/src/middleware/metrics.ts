import { Request, Response, NextFunction } from 'express';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const method = req.method;
  const path = req.route?.path || req.path;
  console.log(`[METRICS] ${method} ${path} - ${Date.now() - startTime}ms`);
  next();
}; 