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
const log_client_1 = require("@observability-hub/log-client");
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const products_1 = __importDefault(require("./routes/products"));
const correlation_id_1 = require("./middleware/correlation-id");
const error_handler_1 = require("./middleware/error-handler");
const request_logging_1 = require("./middleware/request-logging");
const metrics_2 = require("./middleware/metrics");
const logger = new log_client_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
const app = (0, express_1.default)();
(0, config_1.validateConfiguration)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(correlation_id_1.correlationIdMiddleware);
app.use((0, request_logging_1.requestLoggingMiddleware)(logger));
app.use(metrics_2.metricsMiddleware);
app.use('/health', health_1.default);
app.use('/metrics', metrics_1.default);
app.use('/api/v1/products', products_1.default);
app.use(error_handler_1.errorHandlerMiddleware);
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
const server = app.listen(config_1.config.PORT, config_1.config.HOST, () => {
    logger.info(`🚀 Product Service is running on port ${config_1.config.PORT}`);
    logger.info(`📊 Health check: ${config_1.derivedConfig.httpUrl}/health`);
    logger.info(`📈 Metrics: ${config_1.derivedConfig.httpUrl}/metrics`);
    logger.info(`📦 Products API: ${config_1.derivedConfig.httpUrl}/api/v1/products`);
});
process.on('SIGTERM', async () => {
    logger.info('🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    logger.info('🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map