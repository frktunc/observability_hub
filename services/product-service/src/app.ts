import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { ObservabilityLogger } from '@observability-hub/observability';
import { config, derivedConfig } from './config';
// Import shared middleware from unified package
import { 
  defaultCorrelationIdMiddleware,
  defaultErrorHandler,
  requestLoggingMiddleware,
  defaultMetrics
} from '@observability-hub/observability/dist/middleware';
import { createRateLimitMiddleware } from './middleware/rate-limiting';
import { initializeRedis } from './services/redis-client';
import healthRoutes from './routes/health';
import productsRoutes from './routes/products';
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

  // Custom middleware (using shared middleware - NO MORE COPY-PASTE!)
  app.use(defaultCorrelationIdMiddleware);
  app.use(requestLoggingMiddleware({
    customLogger: (level, message, metadata) => {
      console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
    }
  }));
  
  if (config.METRICS_ENABLED) {
    app.use(defaultMetrics);
  }

  // Health check endpoint (before authentication)
  app.use('/health', healthRoutes);
  
  // Metrics endpoint
  if (config.METRICS_ENABLED) {
    app.use('/metrics', metricsRoutes);
  }

  // API routes
  app.use('/api/v1/products', productsRoutes);

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
        title: 'Product Service API',
        version: config.SERVICE_VERSION,
        description: 'Product management microservice with observability logging',
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
                    required: ['name', 'email'],
                    properties: {
                      name: {
                        type: 'string',
                        description: 'User full name',
                      },
                      email: {
                        type: 'string',
                        format: 'email',
                        description: 'User email address',
                      },
                      role: {
                        type: 'string',
                        enum: ['user', 'admin', 'moderator'],
                        default: 'user',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'User created successfully',
              },
              '400': {
                description: 'Invalid input data',
              },
            },
          },
        },
        '/api/v1/users/{id}': {
          get: {
            summary: 'Get user by ID',
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
                description: 'User details',
              },
              '404': {
                description: 'User not found',
              },
            },
          },
          put: {
            summary: 'Update user',
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
                      email: {
                        type: 'string',
                        format: 'email',
                      },
                      role: {
                        type: 'string',
                        enum: ['user', 'admin', 'moderator'],
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'User updated successfully',
              },
              '404': {
                description: 'User not found',
              },
            },
          },
          delete: {
            summary: 'Delete user',
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
                description: 'User deleted successfully',
              },
              '404': {
                description: 'User not found',
              },
            },
          },
        },
      },
    });
  });

  // Error handling middleware (must be last) - using shared middleware
  app.use(defaultErrorHandler);

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