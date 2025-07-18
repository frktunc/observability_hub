import { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config, derivedConfig } from '../config';
import { 
  defaultCorrelationIdMiddleware,
  requestLoggingMiddleware,
  metricsMiddleware
} from '@observability-hub/observability/middleware';
import { createRateLimitMiddleware } from '../middleware/rate-limiting';

export function applyGlobalMiddleware(app: Application) {
  // Trust proxy for accurate client IPs
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    // Tarayıcının sadece belirli kaynaklara erişmesini sağlar.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // Sadece kendi kaynaklara erişim
        styleSrc: ["'self'", "'unsafe-inline'"], // CSS'lerin kendi kaynaklardan yüklenmesini sağlar
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : true,
    credentials: true,
    maxAge: 86400, // 24 hours
  }));

  // Compression middleware
  // Gereksiz veri işlemeyi önler ve performansı artırır.
  if (config.FEATURE_COMPRESSION) {
    app.use(compression({
        // Orta seviyede sıkıştırma.
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }));
  }

  // Body parsing middleware
  // JSON ve form verilerini request body’den okuyabilmek için. limit ile maksimum veri boyutu sınırlandırılmış.
  app.use(require('express').json({ 
    limit: '10mb'
  }));
  app.use(require('express').urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Redis-based rate limiting
  if (config.RATE_LIMIT_ENABLED) {
    const rateLimitMiddleware = createRateLimitMiddleware();
    app.use(rateLimitMiddleware);
  }

  // Custom middleware (using shared middleware)
  app.use(defaultCorrelationIdMiddleware);
  app.use(requestLoggingMiddleware({
    customLogger: (level: string, message: string, metadata?: any) => {
      console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
    }
  }));

  // Metrics middleware
  if (config.METRICS_ENABLED) {
    app.use(metricsMiddleware());
  }
} 