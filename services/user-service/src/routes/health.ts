import { Router, Request, Response } from 'express';
import { createHealthCheckHandler } from '@observability-hub/observability/health';
import { db } from '../services/database';
import { getRedisClient } from '../services/redis-client';
import { rateLimitHealthCheck } from '../middleware/rate-limiting';
import { config } from '../config';
import amqplib from 'amqplib';

const router = Router();

/**
 * RabbitMQ bağlantı sağlığını kontrol eder.
 */
async function checkRabbitMQ(): Promise<{ status: 'connected' | 'error'; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const connection = await amqplib.connect(config.RABBITMQ_URL, {
      timeout: config.RABBITMQ_CONNECTION_TIMEOUT,
      heartbeat: config.RABBITMQ_HEARTBEAT,
    });
    await connection.close();
    return { status: 'connected', latency: Date.now() - start };
  } catch (error: any) {
    return { status: 'error', error: error?.message || 'Unknown error' };
  }
}

/**
 * Health durumunu değerlendirir.
 */
function evaluateStatus(baseStatus: string, rabbitStatus: string): 'healthy' | 'degraded' | 'unhealthy' {
  if (rabbitStatus === 'error') {
    if (baseStatus === 'healthy') return 'degraded';
    if (baseStatus === 'degraded') return 'unhealthy';
  }
  return baseStatus as 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Health check handler oluştur
 */
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
          error: result.error,
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

/**
 * GET /health endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [baseHealth, rabbitHealth] = await Promise.all([
      healthCheckHandler(),
      checkRabbitMQ()
    ]);

    baseHealth.dependencies = {
      ...baseHealth.dependencies,
      rabbitmq: rabbitHealth,
    };

    baseHealth.status = evaluateStatus(baseHealth.status, rabbitHealth.status);

    const statusCode = baseHealth.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(baseHealth);

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
