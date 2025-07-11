import { createApp, initializeServices } from './app';
import { config, derivedConfig } from './config';
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

async function startServer() {
  try {
    // Initialize database connection first
    console.log('🔗 Initializing database connection...');
    await db.connect();
    console.log('✅ Database connected and schema initialized');

    // Initialize Redis and other services
    console.log('🔗 Initializing Redis services...');
    await initializeServices();

    const app = createApp();
    
    // Start the server
    const server = app.listen(config.PORT, () => {
      logger.info('User service started successfully', {
        component: 'server',
        port: config.PORT,
        environment: config.NODE_ENV,
        serviceVersion: config.SERVICE_VERSION,
        databaseStatus: db.getConnectionStatus(),
      });
      
      console.log(`🚀 User Service is running on port ${config.PORT}`);
      console.log(`📊 Health check: http://localhost:${config.PORT}/health`);
      console.log(`📈 Metrics: http://localhost:${config.PORT}/metrics`);
      console.log(`👥 Users API: http://localhost:${config.PORT}/api/v1/users`);
      console.log(`💾 Database: Connected and ready`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`, {
        component: 'server',
        signal,
      });

      server.close(async () => {
        // Disconnect database
        try {
          await db.disconnect();
          console.log('💾 Database disconnected');
        } catch (error) {
          console.error('Error disconnecting database:', error);
        }

        // Disconnect Redis
        try {
          await closeRedis();
          console.log('🔌 Redis disconnected');
        } catch (error) {
          console.error('Error disconnecting Redis:', error);
        }

        logger.info('Server closed', {
          component: 'server',
        });
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout', undefined, {
          component: 'server',
        });
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error as Error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', reason as Error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error, {
      component: 'server',
    });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
