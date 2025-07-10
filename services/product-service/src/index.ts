import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, derivedConfig, validateConfiguration } from './config';
import { v4 as uuidv4 } from 'uuid';
import { db } from './services/database';

// Import routes
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import productsRoutes from './routes/products';

// Import shared middleware (NO MORE COPY-PASTE!)
import { 
  defaultCorrelationIdMiddleware,
  defaultErrorHandler,
  requestLoggingMiddleware,
  defaultMetrics
} from '@observability-hub/shared-middleware';

// Simple console logger (replace with proper observability logger if needed)
const logger = {
  info: (message: string, metadata?: any) => console.log(`[INFO] ${message}`, metadata || ''),
  warn: (message: string, metadata?: any) => console.warn(`[WARN] ${message}`, metadata || ''),
  error: (message: string, metadata?: any) => console.error(`[ERROR] ${message}`, metadata || ''),
  debug: (message: string, metadata?: any) => console.debug(`[DEBUG] ${message}`, metadata || '')
};

// Initialize Express app
const app = express();

// Validate configuration
validateConfiguration();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Custom middleware (using shared middleware - NO MORE COPY-PASTE!)
app.use(defaultCorrelationIdMiddleware);
app.use(requestLoggingMiddleware({
  customLogger: (level, message, metadata) => {
    logger[level](message, metadata);
  }
}));
app.use(defaultMetrics);

// Routes
app.use('/health', healthRoutes);
app.use('/metrics', metricsRoutes);
app.use('/api/v1/products', productsRoutes);

// Error handling (using shared middleware - NO MORE COPY-PASTE!)
app.use(defaultErrorHandler);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: `${derivedConfig.httpUrl}/health`,
      metrics: `${derivedConfig.httpUrl}/metrics`,
      products: `${derivedConfig.httpUrl}/api/v1/products`,
    }
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database connection first
    console.log('🔗 Initializing database connection...');
    await db.connect();
    console.log('✅ Database connected and schema initialized');

    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Product Service is running on port ${config.PORT}`);
      logger.info(`📊 Health check: ${derivedConfig.httpUrl}/health`);
      logger.info(`📈 Metrics: ${derivedConfig.httpUrl}/metrics`);
      logger.info(`📦 Products API: ${derivedConfig.httpUrl}/api/v1/products`);
      logger.info(`💾 Database: Connected and ready`);
    });

    return server;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('❌ Failed to start server:', errorObj);
    console.error('❌ Failed to start server:', errorMessage);
    process.exit(1);
  }
}

let server: any = null;

startServer().then((s) => {
  server = s;
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  if (server) {
    server.close(async () => {
      try {
        await db.disconnect();
        logger.info('✅ Database disconnected');
      } catch (error) {
        logger.error('Error disconnecting database:', error instanceof Error ? error : new Error(String(error)));
      }
      logger.info('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  if (server) {
    server.close(async () => {
      try {
        await db.disconnect();
        logger.info('✅ Database disconnected');
      } catch (error) {
        logger.error('Error disconnecting database:', error instanceof Error ? error : new Error(String(error)));
      }
      logger.info('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app; 