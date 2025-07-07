"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const log_client_1 = require("@observability-hub/log-client");
// Initialize observability logger
const logger = new log_client_1.ObservabilityLogger({
    serviceName: 'user-service',
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.config.RABBITMQ_URL,
    rabbitmqVhost: config_1.config.RABBITMQ_VHOST,
    rabbitmqExchange: config_1.config.RABBITMQ_EXCHANGE,
});
async function startServer() {
    try {
        const app = (0, app_1.createApp)();
        // Start the server
        const server = app.listen(config_1.config.PORT, () => {
            logger.info('User service started successfully', {
                component: 'server',
                port: config_1.config.PORT,
                environment: config_1.config.NODE_ENV,
                serviceVersion: config_1.config.SERVICE_VERSION,
            });
            console.log(`🚀 User Service is running on port ${config_1.config.PORT}`);
            console.log(`📊 Health check: http://localhost:${config_1.config.PORT}/health`);
            console.log(`📈 Metrics: http://localhost:${config_1.config.PORT}/metrics`);
            console.log(`👥 Users API: http://localhost:${config_1.config.PORT}/api/v1/users`);
        });
        // Graceful shutdown
        const gracefulShutdown = (signal) => {
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
        process.exit(1);
    }
}
// Start the server
startServer();
//# sourceMappingURL=index.js.map