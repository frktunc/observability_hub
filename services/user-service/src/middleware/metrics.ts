import { Request, Response, NextFunction } from 'express';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Simple metrics tracking
  // In production, you'd use Prometheus or similar
  next();
}

export const metricsRegistry = {
  // Placeholder for metrics registry
}; 