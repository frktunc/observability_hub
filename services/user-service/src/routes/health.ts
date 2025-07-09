import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { getRedisClient } from '../services/redis-client';
import { rateLimitHealthCheck } from '../middleware/rate-limiting';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database health
    const dbStatus = db.getConnectionStatus();
    
    // Check Redis health
    let redisHealth;
    try {
      const redisClient = getRedisClient();
      redisHealth = await redisClient.healthCheck();
    } catch (error) {
      redisHealth = { status: 'error', error: 'Redis not initialized' };
    }

    // Check rate limiting health
    const rateLimitHealth = await rateLimitHealthCheck();

    const overallStatus = 
      dbStatus && redisHealth.status === 'connected' 
        ? 'healthy' 
        : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'user-service',
      dependencies: {
        database: {
          status: dbStatus ? 'connected' : 'disconnected',
        },
        redis: redisHealth,
        rateLimiting: rateLimitHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'user-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as healthRoutes }; 