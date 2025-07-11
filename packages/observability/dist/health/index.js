"use strict";
/// <reference types="node" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadinessCheckHandler = exports.createHealthCheckHandler = void 0;
const createHealthCheckHandler = (serviceName, serviceVersion, dependencies) => {
    return async () => {
        try {
            // Check database health
            const dbStatus = dependencies.database.getConnectionStatus();
            const databaseHealth = {
                status: dbStatus ? 'connected' : 'disconnected',
            };
            // Check Redis health (if available)
            let redisHealth;
            if (dependencies.redis) {
                try {
                    redisHealth = await dependencies.redis.healthCheck();
                }
                catch (error) {
                    redisHealth = {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Redis health check failed'
                    };
                }
            }
            // Check rate limiting health (if available)
            let rateLimitHealth;
            if (dependencies.rateLimiting) {
                try {
                    rateLimitHealth = await dependencies.rateLimiting.healthCheck();
                }
                catch (error) {
                    rateLimitHealth = {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Rate limiting health check failed'
                    };
                }
            }
            // Determine overall status
            const allDependencies = [
                databaseHealth,
                redisHealth,
                rateLimitHealth,
            ].filter(Boolean);
            const hasError = allDependencies.some(dep => dep.status === 'error');
            const hasDisconnected = allDependencies.some(dep => dep.status === 'disconnected');
            const hasDegraded = allDependencies.some(dep => dep.status === 'degraded');
            let overallStatus;
            if (hasError) {
                overallStatus = 'unhealthy';
            }
            else if (hasDisconnected || hasDegraded) {
                overallStatus = 'degraded';
            }
            else {
                overallStatus = 'healthy';
            }
            const result = {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: serviceName,
                version: serviceVersion,
                environment: process.env.NODE_ENV || 'development',
                dependencies: {
                    database: databaseHealth,
                    ...(redisHealth && { redis: redisHealth }),
                    ...(rateLimitHealth && { rateLimiting: rateLimitHealth }),
                },
            };
            return result;
        }
        catch (error) {
            const errorResult = {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: serviceName,
                version: serviceVersion,
                environment: process.env.NODE_ENV || 'development',
                dependencies: {
                    database: { status: 'error', error: 'Health check failed' },
                },
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            return errorResult;
        }
    };
};
exports.createHealthCheckHandler = createHealthCheckHandler;
const createReadinessCheckHandler = (serviceName, serviceVersion, dependencies) => {
    return async () => {
        try {
            // Readiness requires all critical dependencies to be working
            const dbStatus = dependencies.database.getConnectionStatus();
            let redisStatus = true; // Redis is optional for readiness
            if (dependencies.redis) {
                redisStatus = dependencies.redis.isClientConnected();
            }
            const isReady = dbStatus && redisStatus;
            return {
                status: isReady ? 'ready' : 'not ready',
                service: serviceName,
                version: serviceVersion,
                timestamp: new Date().toISOString(),
                dependencies: {
                    database: dbStatus ? 'ready' : 'not ready',
                    ...(dependencies.redis && { redis: redisStatus ? 'ready' : 'not ready' }),
                },
            };
        }
        catch (error) {
            return {
                status: 'not ready',
                service: serviceName,
                version: serviceVersion,
                timestamp: new Date().toISOString(),
                dependencies: {
                    database: 'error',
                },
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    };
};
exports.createReadinessCheckHandler = createReadinessCheckHandler;
//# sourceMappingURL=index.js.map