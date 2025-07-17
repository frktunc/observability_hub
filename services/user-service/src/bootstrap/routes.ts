import { Application } from 'express';
import { healthRoutes } from '@/routes/health';
import { userRoutes } from '@/routes/users';
import { metricsRoutes } from '@/routes/metrics';
import { config } from '@/config';

export function applyRoutes(app: Application) {
  // Health check endpoint (before authentication)
  app.use('/health', healthRoutes);

  // Metrics endpoint
  if (config.METRICS_ENABLED) {
    app.use('/metrics', metricsRoutes);
  }

  // API routes
  app.use('/api/v1/users', userRoutes);
}
