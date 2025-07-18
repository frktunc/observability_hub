import express from 'express';
import { applyGlobalMiddleware } from '@/bootstrap/global-middleware';
import { applyRoutes } from '@/bootstrap/routes';
import { applyDocsEndpoint } from '@/bootstrap/docs';
import { defaultErrorHandler } from '@observability-hub/observability/middleware';

export function createApp(): express.Application {
  const app = express();

  // Global middleware
  applyGlobalMiddleware(app);

  // Ana route'lar
  applyRoutes(app);

  // API dokümantasyon endpointi
  applyDocsEndpoint(app);

  // Error handling middleware (must be last)
  app.use(defaultErrorHandler);

  return app;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string; // 	Her isteğe özel benzersiz ID; log takibi, tracing
      requestId?: string; // Genellikle proxy veya API Gateway’lerden gelen ID
      tenantId?: string; // 	Kullanıcının ait olduğu kurum/şirket ID'si
      startTime?: number; // 	İstek başlangıç zamanı
      rawBody?: Buffer; // 	Raw body verisi
    }
  }
}
