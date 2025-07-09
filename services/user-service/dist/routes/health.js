"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../services/database");
const redis_client_1 = require("../services/redis-client");
const rate_limiting_1 = require("../middleware/rate-limiting");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
router.get('/', async (req, res) => {
    try {
        // Check database health
        const dbStatus = database_1.db.getConnectionStatus();
        // Check Redis health
        let redisHealth;
        try {
            const redisClient = (0, redis_client_1.getRedisClient)();
            redisHealth = await redisClient.healthCheck();
        }
        catch (error) {
            redisHealth = { status: 'error', error: 'Redis not initialized' };
        }
        // Check rate limiting health
        const rateLimitHealth = await (0, rate_limiting_1.rateLimitHealthCheck)();
        const overallStatus = dbStatus && redisHealth.status === 'connected'
            ? 'healthy'
            : 'degraded';
        res.json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'user-service',
            dependencies: {
                database: {
                    status: dbStatus ? 'connected' : 'disconnected',
                },
                redis: redisHealth,
                rateLimiting: rateLimitHealth,
            },
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'user-service',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=health.js.map