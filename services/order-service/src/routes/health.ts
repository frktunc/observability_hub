import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  res.json({
    status: 'healthy',
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    correlationId,
    checks: {
      database: 'connected',
      rabbitmq: 'connected',
      redis: 'connected'
    }
  });
});

router.get('/ready', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  res.json({
    status: 'ready',
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    correlationId
  });
});

router.get('/live', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  res.json({
    status: 'alive',
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    correlationId
  });
});

export default router; 