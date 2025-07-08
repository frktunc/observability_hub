import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { ObservabilityLogger } from '@observability-hub/log-client';
import { config, derivedConfig } from './config';
import { metricsMiddleware, metricsRegistry } from './middleware/metrics';
import { requestLoggingMiddleware } from './middleware/request-logging';
import { errorHandler } from './middleware/error-handler';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { healthRoutes } from './routes/health';
import { userRoutes } from './routes/users';
import { metricsRoutes } from './routes/metrics';

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

  // Rate limiting
  if (config.RATE_LIMIT_ENABLED) {
        const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use tenant ID for multi-tenant rate limiting
        const tenantId = req.headers[config.TENANT_HEADER_NAME] || config.DEFAULT_TENANT_ID;
        const clientId = req.ip || 'unknown';
        return `${tenantId}:${clientId}`;
      },
    });

    app.use(limiter);

    // Speed limiter for additional protection
    const speedLimiter = slowDown({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      delayAfter: Math.floor(config.RATE_LIMIT_MAX_REQUESTS * 0.5),
      delayMs: () => 500,
      maxDelayMs: 20000,
    });

    app.use(speedLimiter);
  }

  // Custom middleware
  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);
  
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
  app.use('/api/v1/users', userRoutes);

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
        users: '/api/v1/users',
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
        '/api/v1/users': {
          get: {
            summary: 'List all users',
            responses: {
              '200': {
                description: 'List of users',
              },
            },
          },
          post: {
            summary: 'Create a new user',
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

  // Error handling middleware (must be last)
  app.use(errorHandler);

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