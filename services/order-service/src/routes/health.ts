import { Router, Request, Response } from 'express';
import { config } from '../config';
import { db } from '../services/database';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    // Database health check
    const dbStatus = db.getConnectionStatus();
    
    // Detailed health status
    const healthStatus = {
      status: dbStatus ? 'healthy' : 'degraded',
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      correlationId,
      checks: {
        database: {
          status: dbStatus ? 'connected' : 'disconnected',
          connection: dbStatus
        },
        application: {
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      }
    };

    // Return appropriate status code
    const statusCode = dbStatus ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    res.status(503).json({
      status: 'unhealthy',
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      correlationId,
      error: errorMessage,
      checks: {
        database: {
          status: 'error',
          connection: false
        },
        application: {
          status: 'error'
        }
      }
    });
  }
});

router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    // Readiness requires database connection
    const dbStatus = db.getConnectionStatus();
    
    if (dbStatus) {
      res.json({
        status: 'ready',
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        correlationId,
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
        correlationId,
        dependencies: {
          database: 'not ready'
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    res.status(503).json({
      status: 'not ready',
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      correlationId,
      error: errorMessage
    });
  }
});

router.get('/live', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  // Liveness just checks if the process is running
  res.json({
    status: 'alive',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    correlationId,
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version
    }
  });
});

export default router; 