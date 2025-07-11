import { createApp, initializeServices } from './app';
import { config, derivedConfig, validateConfiguration } from './config';
import { ObservabilityLogger } from '@observability-hub/observability';
import { db } from './services/database';
import { closeRedis } from './services/redis-client';

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

// Validate configuration on startup
validateConfiguration();

// Create Express app using factory function
const app = createApp();

// Start server
async function startServer() {
  try {
    // Initialize database connection first
    console.log('🔗 Initializing database connection...');
    await db.connect();
    console.log('✅ Database connected and schema initialized');

    // Initialize observability services (Redis, etc.)
    console.log('🔗 Initializing observability services...');
    await initializeServices();
    console.log('✅ Observability services initialized');

    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Product Service is running on port ${config.PORT}`);
      logger.info(`📊 Health check: ${derivedConfig.httpUrl}/health`);
      logger.info(`📈 Metrics: ${derivedConfig.httpUrl}/metrics`);
      logger.info(`📦 Products API: ${derivedConfig.httpUrl}/api/v1/products`);
      logger.info(`💾 Database: Connected and ready`);
      logger.info(`🎯 Redis: Connected for rate limiting`);
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
        
        await closeRedis();
        logger.info('✅ Redis disconnected');
      } catch (error) {
        logger.error('Error during shutdown:', error instanceof Error ? error : new Error(String(error)));
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
        
        await closeRedis();
        logger.info('✅ Redis disconnected');
      } catch (error) {
        logger.error('Error during shutdown:', error instanceof Error ? error : new Error(String(error)));
      }
      logger.info('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app; 