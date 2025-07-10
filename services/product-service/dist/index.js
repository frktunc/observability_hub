"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("./config");
const database_1 = require("./services/database");
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const products_1 = __importDefault(require("./routes/products"));
const shared_middleware_1 = require("@observability-hub/shared-middleware");
const logger = {
    info: (message, metadata) => console.log(`[INFO] ${message}`, metadata || ''),
    warn: (message, metadata) => console.warn(`[WARN] ${message}`, metadata || ''),
    error: (message, metadata) => console.error(`[ERROR] ${message}`, metadata || ''),
    debug: (message, metadata) => console.debug(`[DEBUG] ${message}`, metadata || '')
};
const app = (0, express_1.default)();
(0, config_1.validateConfiguration)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(shared_middleware_1.defaultCorrelationIdMiddleware);
app.use((0, shared_middleware_1.requestLoggingMiddleware)({
    customLogger: (level, message, metadata) => {
        logger[level](message, metadata);
    }
}));
app.use(shared_middleware_1.defaultMetrics);
app.use('/health', health_1.default);
app.use('/metrics', metrics_1.default);
app.use('/api/v1/products', products_1.default);
app.use(shared_middleware_1.defaultErrorHandler);
app.get('/', (req, res) => {
    res.json({
        service: config_1.config.SERVICE_NAME,
        version: config_1.config.SERVICE_VERSION,
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: `${config_1.derivedConfig.httpUrl}/health`,
            metrics: `${config_1.derivedConfig.httpUrl}/metrics`,
            products: `${config_1.derivedConfig.httpUrl}/api/v1/products`,
        }
    });
});
async function startServer() {
    try {
        console.log('🔗 Initializing database connection...');
        await database_1.db.connect();
        console.log('✅ Database connected and schema initialized');
        const server = app.listen(config_1.config.PORT, config_1.config.HOST, () => {
            logger.info(`🚀 Product Service is running on port ${config_1.config.PORT}`);
            logger.info(`📊 Health check: ${config_1.derivedConfig.httpUrl}/health`);
            logger.info(`📈 Metrics: ${config_1.derivedConfig.httpUrl}/metrics`);
            logger.info(`📦 Products API: ${config_1.derivedConfig.httpUrl}/api/v1/products`);
            logger.info(`💾 Database: Connected and ready`);
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
            }
            catch (error) {
                logger.error('Error disconnecting database:', error instanceof Error ? error : new Error(String(error)));
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
            }
            catch (error) {
                logger.error('Error disconnecting database:', error instanceof Error ? error : new Error(String(error)));
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