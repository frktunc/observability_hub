"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const health_1 = require("@observability-hub/observability/health");
const database_1 = require("../services/database");
const redis_client_1 = require("../services/redis-client");
const rate_limiting_1 = require("../middleware/rate-limiting");
const config_1 = require("../config");
const amqplib_1 = __importDefault(require("amqplib"));
const router = (0, express_1.Router)();
exports.healthRoutes = router;
/**
 * RabbitMQ bağlantı sağlığını kontrol eder.
 */
async function checkRabbitMQ() {
    const start = Date.now();
    try {
        const connection = await amqplib_1.default.connect(config_1.config.RABBITMQ_URL, {
            timeout: config_1.config.RABBITMQ_CONNECTION_TIMEOUT,
            heartbeat: config_1.config.RABBITMQ_HEARTBEAT,
        });
        await connection.close();
        return { status: 'connected', latency: Date.now() - start };
    }
    catch (error) {
        return { status: 'error', error: error?.message || 'Unknown error' };
    }
}
/**
 * Health durumunu değerlendirir.
 */
function evaluateStatus(baseStatus, rabbitStatus) {
    if (rabbitStatus === 'error') {
        if (baseStatus === 'healthy')
            return 'degraded';
        if (baseStatus === 'degraded')
            return 'unhealthy';
    }
    return baseStatus;
}
/**
 * Health check handler oluştur
 */
const healthCheckHandler = (0, health_1.createHealthCheckHandler)(config_1.config.SERVICE_NAME, config_1.config.SERVICE_VERSION, {
    database: database_1.db,
    redis: {
        isClientConnected: () => (0, redis_client_1.getRedisClient)().isClientConnected(),
        healthCheck: async () => {
            const result = await (0, redis_client_1.getRedisClient)().healthCheck();
            return {
                status: result.status === 'connected' ? 'connected' : 'error',
                latency: result.latency,
                error: result.error,
            };
        }
    },
    rateLimiting: {
        healthCheck: async () => {
            const result = await (0, rate_limiting_1.rateLimitHealthCheck)();
            return {
                status: result.redis ? 'connected' : 'degraded',
                details: result
            };
        }
    }
});
/**
 * GET /health endpoint
 */
router.get('/', async (req, res) => {
    try {
        const [baseHealth, rabbitHealth] = await Promise.all([
            healthCheckHandler(),
            checkRabbitMQ()
        ]);
        baseHealth.dependencies = {
            ...baseHealth.dependencies,
            rabbitmq: rabbitHealth,
        };
        baseHealth.status = evaluateStatus(baseHealth.status, rabbitHealth.status);
        const statusCode = baseHealth.status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json(baseHealth);
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: config_1.config.SERVICE_NAME,
            version: config_1.config.SERVICE_VERSION,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=health.js.map