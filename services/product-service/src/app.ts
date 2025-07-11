import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config, derivedConfig } from './config';
import { ObservabilityLogger } from '@observability-hub/observability';
import {
  correlationIdMiddleware,
  errorHandlerMiddleware,
  requestLoggingMiddleware,
  metricsMiddleware,
} from '@observability-hub/observability/middleware';
import { createRateLimitMiddleware } from './middleware/rate-limiting';
import { initializeRedis } from './services/redis-client';
import healthRoutes from './routes/health';
import productRoutes from './routes/products';
import metricsRoutes from './routes/metrics';

// Initialize observability logger
const logger = new ObservabilityLogger({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqUrl: derivedConfig.rabbitmq.url,
  rabbitmqVhost: derivedConfig.rabbitmq.vhost,
  rabbitmqExchange: derivedConfig.rabbitmq.exchange,
  defaultLogLevel: config.LOG_LEVEL as any,
});

// Initialize Redis client
export async function initializeServices(): Promise<void> {
  try {
    if (derivedConfig.redis.rateLimiting.enabled) {
      await initializeRedis();
      console.log('🎯 Redis services initialized successfully');
    } else {
      console.log('⚠️ Redis rate limiting disabled, using memory fallback');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Redis, falling back to memory rate limiting:', error);
    // Don't throw error - let the app continue with memory fallback
  }
}

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for accurate client IPs
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
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
  if (config.FEATURE_COMPRESSION) {
    app.use(compression({
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
  app.use(express.json({ 
    limit: '10mb'
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Redis-based rate limiting
  if (config.RATE_LIMIT_ENABLED) {
    const rateLimitMiddleware = createRateLimitMiddleware();
    app.use(rateLimitMiddleware);
  }

  // Custom middleware
  app.use(correlationIdMiddleware());
  app.use(requestLoggingMiddleware({ 
    customLogger: (level, message, meta) => {
      switch (level) {
        case 'warn':
          logger.warn(message, meta);
          break;
        case 'error':
          logger.error(message, new Error(message), meta);
          break;
        default:
          logger.info(message, meta);
          break;
      }
    } 
  }));
  
  if (config.METRICS_ENABLED) {
    app.use(metricsMiddleware);
  }

  // Health check endpoint (before authentication)
  app.use('/health', healthRoutes);
  
  // Metrics endpoint
  if (config.METRICS_ENABLED) {
    app.use('/metrics', metricsRoutes);
  }

  // API routes
  app.use('/api/v1/products', productRoutes);

  // Welcome endpoint
  app.get('/', (req, res) => {
    res.json({
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      endpoints: {
        health: '/health',
        metrics: '/metrics',
        products: '/api/v1/products',
        documentation: '/api/v1/docs',
      },
    });
  });

  // API documentation endpoint
  app.get('/api/v1/docs', (req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'User Service API',
        version: config.SERVICE_VERSION,
        description: 'User management microservice with observability logging',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check endpoint',
            responses: {
              '200': {
                description: 'Service is healthy',
              },
            },
          },
        },
        '/metrics': {
          get: {
            summary: 'Prometheus metrics endpoint',
            responses: {
              '200': {
                description: 'Metrics in Prometheus format',
              },
            },
          },
        },
        '/api/v1/products': {
          get: {
            summary: 'List all products',
            responses: {
              '200': {
                description: 'List of products',
              },
            },
          },
          post: {
            summary: 'Create a new product',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name', 'price'],
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Product name',
                      },
                      price: {
                        type: 'number',
                        description: 'Product price',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Product created successfully',
              },
              '400': {
                description: 'Invalid input data',
              },
            },
          },
        },
        '/api/v1/products/{id}': {
          get: {
            summary: 'Get product by ID',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Product details',
              },
              '404': {
                description: 'Product not found',
              },
            },
          },
          put: {
            summary: 'Update product',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      price: {
                        type: 'number',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Product updated successfully',
              },
              '404': {
                description: 'Product not found',
              },
            },
          },
          delete: {
            summary: 'Delete product',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '204': {
                description: 'Product deleted successfully',
              },
              '404': {
                description: 'Product not found',
              },
            },
          },
        },
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandlerMiddleware({ customLogger: (err, req) => logger.error(err.message, err, { request: { httpMethod: req.method, path: req.path, correlationId: req.correlationId } }) }));

  return app;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      requestId?: string;
      tenantId?: string;
      startTime?: number;
      rawBody?: Buffer;
    }
  }
}
