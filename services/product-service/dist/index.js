"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const observability_1 = require("@observability-hub/observability");
const database_1 = require("./services/database");
const redis_client_1 = require("./services/redis-client");
const logger = new observability_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
(0, config_1.validateConfiguration)();
const app = (0, app_1.createApp)();
async function startServer() {
    try {
        console.log('🔗 Initializing database connection...');
        await database_1.db.connect();
        console.log('✅ Database connected and schema initialized');
        console.log('🔗 Initializing observability services...');
        await (0, app_1.initializeServices)();
        console.log('✅ Observability services initialized');
        const server = app.listen(config_1.config.PORT, config_1.config.HOST, () => {
            logger.info(`🚀 Product Service is running on port ${config_1.config.PORT}`);
            logger.info(`📊 Health check: ${config_1.derivedConfig.httpUrl}/health`);
            logger.info(`📈 Metrics: ${config_1.derivedConfig.httpUrl}/metrics`);
            logger.info(`📦 Products API: ${config_1.derivedConfig.httpUrl}/api/v1/products`);
            logger.info(`💾 Database: Connected and ready`);
            logger.info(`🎯 Redis: Connected for rate limiting`);
        });
        return server;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error('❌ Failed to start server:', errorObj);
        console.error('❌ Failed to start server:', errorMessage);
        process.exit(1);
    }
}
let server = null;
startServer().then((s) => {
    server = s;
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
process.on('SIGTERM', async () => {
    logger.info('🛑 Received SIGTERM, shutting down gracefully...');
    if (server) {
        server.close(async () => {
            try {
                await database_1.db.disconnect();
                logger.info('✅ Database disconnected');
                await (0, redis_client_1.closeRedis)();
                logger.info('✅ Redis disconnected');
            }
            catch (error) {
                logger.error('Error during shutdown:', error instanceof Error ? error : new Error(String(error)));
            }
            logger.info('✅ Server closed');
            process.exit(0);
        });
    }
    else {
        process.exit(0);
    }
});
process.on('SIGINT', async () => {
    logger.info('🛑 Received SIGINT, shutting down gracefully...');
    if (server) {
        server.close(async () => {
            try {
                await database_1.db.disconnect();
                logger.info('✅ Database disconnected');
                await (0, redis_client_1.closeRedis)();
                logger.info('✅ Redis disconnected');
            }
            catch (error) {
                logger.error('Error during shutdown:', error instanceof Error ? error : new Error(String(error)));
            }
            logger.info('✅ Server closed');
            process.exit(0);
        });
    }
    else {
        process.exit(0);
    }
});
exports.default = app;
//# sourceMappingURL=index.js.map