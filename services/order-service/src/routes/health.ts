import { Router, Request, Response } from 'express';
import { createHealthCheckHandler } from '@observability-hub/observability/health';
import { config } from '../config';
import { db } from '../services/database';

const router = Router();

// Create health check handler using observability package
const healthCheckHandler = createHealthCheckHandler(
  config.SERVICE_NAME,
  config.SERVICE_VERSION,
  {
    database: db
  }
);

router.get('/', async (req: Request, res: Response): Promise<void> => {
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

router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Readiness requires database connection
    const dbStatus = db.getConnectionStatus();
    
    if (dbStatus) {
      res.json({
        status: 'ready',
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: 'ready'
        }
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: 'not ready'
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/live', (req: Request, res: Response): void => {
  // Liveness just checks if the process is running
  res.json({
    status: 'alive',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version
    }
  });
});

export default router; 