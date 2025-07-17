"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const health_1 = require("@observability-hub/observability/health");
const database_1 = require("../services/database");
const redis_client_1 = require("../services/redis-client");
const rate_limiting_1 = require("../middleware/rate-limiting");
const config_1 = require("../config");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
// Create health check handler using observability package
const healthCheckHandler = (0, health_1.createHealthCheckHandler)(config_1.config.SERVICE_NAME, config_1.config.SERVICE_VERSION, {
    database: database_1.db,
    redis: {
        isClientConnected: () => (0, redis_client_1.getRedisClient)().isClientConnected(),
        healthCheck: async () => {
            const result = await (0, redis_client_1.getRedisClient)().healthCheck();
            return {
                status: result.status === 'connected' ? 'connected' : 'error',
                latency: result.latency,
                error: result.error
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
router.get('/', async (req, res) => {
    try {
        const healthResult = await healthCheckHandler();
        // Return appropriate status code based on health
        const statusCode = healthResult.status === 'healthy' ? 200 :
            healthResult.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(healthResult);
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