import { Router, Request, Response } from 'express';
import { getMetrics } from '@observability-hub/observability/middleware';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const metrics = getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 