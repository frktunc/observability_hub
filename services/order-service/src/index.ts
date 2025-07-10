import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, derivedConfig, validateConfiguration } from './config';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { db } from './services/database';

// Import routes
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import ordersRoutes from './routes/orders';

// Import middleware
import { correlationIdMiddleware } from './middleware/correlation-id';
import { errorHandlerMiddleware } from './middleware/error-handler';
import { requestLoggingMiddleware } from './middleware/request-logging';
import { metricsMiddleware } from './middleware/metrics';

// Initialize logger
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

    // Custom middleware
    app.use(correlationIdMiddleware);
    app.use(requestLoggingMiddleware(logger));
    app.use(metricsMiddleware);

    // Routes
    app.use('/health', healthRoutes);
    app.use('/metrics', metricsRoutes);
    app.use('/api/v1/orders', ordersRoutes);

    // Error handling
    app.use(errorHandlerMiddleware);

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        status: 'running',
        timestamp: new Date().toISOString(),
        database: db.getConnectionStatus() ? 'connected' : 'disconnected',
        endpoints: {
          health: `${derivedConfig.httpUrl}/health`,
          metrics: `${derivedConfig.httpUrl}/metrics`,
          orders: `${derivedConfig.httpUrl}/api/v1/orders`,
        }
      });
    });

    // Start server
    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info('Order service started successfully', {
        component: 'server',
        port: config.PORT,
        environment: config.NODE_ENV,
        serviceVersion: config.SERVICE_VERSION,
        databaseStatus: db.getConnectionStatus(),
      });
      
      console.log(`🚀 Order Service is running on port ${config.PORT}`);
      console.log(`📊 Health check: ${derivedConfig.httpUrl}/health`);
      console.log(`📈 Metrics: ${derivedConfig.httpUrl}/metrics`);
      console.log(`🛒 Orders API: ${derivedConfig.httpUrl}/api/v1/orders`);
      console.log(`💾 Database: Connected and ready`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      server.close(async () => {
        await db.disconnect();
        logger.info('✅ Server and database closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      server.close(async () => {
        await db.disconnect();
        logger.info('✅ Server and database closed');
        process.exit(0);
      });
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

// Start the server
startServer();

export default startServer;
