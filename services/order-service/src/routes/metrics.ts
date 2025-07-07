import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  res.json({
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    correlationId,
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform
    }
  });
});

export default router; 