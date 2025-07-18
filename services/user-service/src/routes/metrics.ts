import { Router, Request, Response } from 'express';
import { register } from 'prom-client';

const router = Router();
router.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({
      error: 'Failed to get metrics',
      details: errorMessage,
    });
  }
});

export { router as metricsRoutes };