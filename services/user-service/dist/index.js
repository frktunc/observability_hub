"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const observability_1 = require("@observability-hub/observability");
const database_1 = require("./services/database");
const redis_client_1 = require("./services/redis-client");
// Initialize observability logger
const logger = new observability_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
async function startServer() {
    try {
        // Initialize database connection first
        console.log('🔗 Initializing database connection...');
        await database_1.db.connect();
        console.log('✅ Database connected and schema initialized');
        // Initialize Redis and other services
        console.log('🔗 Initializing Redis services...');
        await (0, app_1.initializeServices)();
        const app = (0, app_1.createApp)();
        // Start the server
        const server = app.listen(config_1.config.PORT, () => {
            logger.info('User service started successfully', {
                component: 'server',
                port: config_1.config.PORT,
                environment: config_1.config.NODE_ENV,
                serviceVersion: config_1.config.SERVICE_VERSION,
                databaseStatus: database_1.db.getConnectionStatus(),
            });
            console.log(`🚀 User Service is running on port ${config_1.config.PORT}`);
            console.log(`📊 Health check: http://localhost:${config_1.config.PORT}/health`);
            console.log(`📈 Metrics: http://localhost:${config_1.config.PORT}/metrics`);
            console.log(`👥 Users API: http://localhost:${config_1.config.PORT}/api/v1/users`);
            console.log(`💾 Database: Connected and ready`);
        });
        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully`, {
                component: 'server',
                signal,
            });
            server.close(async () => {
                // Disconnect database
                try {
                    await database_1.db.disconnect();
                    console.log('💾 Database disconnected');
                }
                catch (error) {
                    console.error('Error disconnecting database:', error);
                }
                // Disconnect Redis
                try {
                    await (0, redis_client_1.closeRedis)();
                    console.log('🔌 Redis disconnected');
                }
                catch (error) {
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
            logger.error('Uncaught exception', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection', reason);
            process.exit(1);
        });
    }
    catch (error) {
        logger.error('Failed to start server', error, {
            component: 'server',
        });
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Start the server
startServer();
//# sourceMappingURL=index.js.map