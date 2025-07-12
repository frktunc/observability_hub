import { Router, Request, Response } from 'express';
import { createHealthCheckHandler } from '@observability-hub/observability/health';
import { db } from '../services/database';
import { getRedisClient } from '../services/redis-client';
import { rateLimitHealthCheck } from '../middleware/rate-limiting';
import { config } from '../config';

const router = Router();

// Create health check handler using observability package
const healthCheckHandler = createHealthCheckHandler(
  config.SERVICE_NAME,
  config.SERVICE_VERSION,
  {
    database: db,
    redis: {
      isClientConnected: () => getRedisClient().isClientConnected(),
      healthCheck: async () => {
        const result = await getRedisClient().healthCheck();
        return {
          status: result.status === 'connected' ? 'connected' : 'error',
          latency: result.latency,
          error: result.error
        };
      }
    },
    rateLimiting: {
      healthCheck: async () => {
        const result = await rateLimitHealthCheck();
        return {
          status: result.redis ? 'connected' : 'degraded',
          details: result
        };
      }
    }
  }
);

router.get('/', async (req: Request, res: Response) => {
  try {
    const healthResult = await healthCheckHandler();
    
    // Return appropriate status code based on health
    const statusCode = healthResult.status === 'healthy' ? 200 : 
                      healthResult.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthResult);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as healthRoutes }; 