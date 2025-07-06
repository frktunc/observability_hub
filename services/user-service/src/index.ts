import { createApp } from './app';
import { config } from './config';
import { ObservabilityLogger } from '@observability-hub/log-client';

// Initialize observability logger
const logger = new ObservabilityLogger({
  serviceName: 'user-service',
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqUrl: config.RABBITMQ_URL,
  rabbitmqVhost: config.RABBITMQ_VHOST,
  rabbitmqExchange: config.RABBITMQ_EXCHANGE,
});

async function startServer() {
  try {
    const app = createApp();
    
    // Start the server
    const server = app.listen(config.PORT, () => {
      logger.info('User service started successfully', {
        component: 'server',
        port: config.PORT,
        environment: config.NODE_ENV,
        serviceVersion: config.SERVICE_VERSION,
      });
      
      console.log(`🚀 User Service is running on port ${config.PORT}`);
      console.log(`📊 Health check: http://localhost:${config.PORT}/health`);
      console.log(`📈 Metrics: http://localhost:${config.PORT}/metrics`);
      console.log(`👥 Users API: http://localhost:${config.PORT}/api/v1/users`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`, {
        component: 'server',
        signal,
      });

      server.close(() => {
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
    process.exit(1);
  }
}

// Start the server
startServer();
