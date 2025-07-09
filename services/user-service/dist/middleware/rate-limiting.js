"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitHealthCheck = exports.getRateLimitStatus = exports.resetRateLimit = exports.createRateLimitMiddleware = exports.getRateLimitingMiddleware = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const redis_client_1 = require("../services/redis-client");
const config_1 = require("../config");
class RateLimitingMiddleware {
    redisLimiter = null;
    memoryLimiter;
    isRedisEnabled;
    constructor() {
        this.isRedisEnabled = config_1.derivedConfig.redis.rateLimiting.enabled;
        const rateLimiterOptions = {
            keyPrefix: config_1.derivedConfig.redis.rateLimiting.prefix,
            points: config_1.derivedConfig.redis.rateLimiting.maxRequests, // Maximum requests
            duration: Math.ceil(config_1.derivedConfig.redis.rateLimiting.windowMs / 1000), // Window in seconds
            blockDuration: Math.ceil(config_1.derivedConfig.redis.rateLimiting.windowMs / 1000), // Block for the same duration
            execEvenly: true, // Distribute requests evenly across the duration
        };
        // Initialize memory limiter as fallback
        this.memoryLimiter = new rate_limiter_flexible_1.RateLimiterMemory(rateLimiterOptions);
        // Initialize Redis limiter if enabled
        if (this.isRedisEnabled) {
            this.initializeRedisLimiter(rateLimiterOptions);
        }
    }
    initializeRedisLimiter(options) {
        try {
            const redisClient = (0, redis_client_1.getRedisClient)();
            this.redisLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
                ...options,
                storeClient: redisClient.getClient(),
                insuranceLimiter: this.memoryLimiter, // Fallback to memory if Redis fails
            });
            console.log('✅ Redis rate limiter initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize Redis rate limiter, falling back to memory:', error);
            this.redisLimiter = null;
        }
    }
    generateKey(req) {
        // Multi-tenant rate limiting key
        const tenantId = req.headers[config_1.config.TENANT_HEADER_NAME] || config_1.config.DEFAULT_TENANT_ID;
        const clientId = req.ip || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        // Include endpoint path for more granular limiting
        const endpoint = req.route?.path || req.path;
        return `${tenantId}:${clientId}:${endpoint}:${userAgent.slice(0, 50)}`;
    }
    async getRateLimitInfo(remainingPoints, msBeforeNext) {
        const limit = config_1.derivedConfig.redis.rateLimiting.maxRequests;
        const remaining = Math.max(0, remainingPoints);
        const reset = new Date(Date.now() + msBeforeNext);
        const retryAfter = msBeforeNext > 0 ? Math.ceil(msBeforeNext / 1000) : undefined;
        return { limit, remaining, reset, retryAfter };
    }
    setRateLimitHeaders(res, info) {
        res.set({
            'X-RateLimit-Limit': info.limit.toString(),
            'X-RateLimit-Remaining': info.remaining.toString(),
            'X-RateLimit-Reset': info.reset.toISOString(),
        });
        if (info.retryAfter) {
            res.set('Retry-After', info.retryAfter.toString());
        }
    }
    async middleware(req, res, next) {
        try {
            const key = this.generateKey(req);
            const limiter = this.redisLimiter || this.memoryLimiter;
            // Try to consume a point
            const result = await limiter.consume(key);
            // Set rate limit headers
            const info = await this.getRateLimitInfo(result.remainingPoints || 0, result.msBeforeNext || 0);
            this.setRateLimitHeaders(res, info);
            next();
        }
        catch (rejectedResult) {
            // Rate limit exceeded
            const info = await this.getRateLimitInfo(rejectedResult.remainingPoints || 0, rejectedResult.msBeforeNext || 0);
            this.setRateLimitHeaders(res, info);
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: info.retryAfter,
                limit: info.limit,
                remaining: info.remaining,
                reset: info.reset,
            });
        }
    }
    // Method to reset rate limits for a specific key (useful for testing or admin operations)
    async resetKey(key) {
        try {
            const limiter = this.redisLimiter || this.memoryLimiter;
            await limiter.delete(key);
            console.log(`Rate limit reset for key: ${key}`);
        }
        catch (error) {
            console.error(`Failed to reset rate limit for key ${key}:`, error);
            throw error;
        }
    }
    // Method to get current rate limit status for a key
    async getStatus(key) {
        try {
            const limiter = this.redisLimiter || this.memoryLimiter;
            const result = await limiter.get(key);
            if (!result) {
                return null;
            }
            return await this.getRateLimitInfo(result.remainingPoints || 0, result.msBeforeNext || 0);
        }
        catch (error) {
            console.error(`Failed to get rate limit status for key ${key}:`, error);
            return null;
        }
    }
    // Health check method
    async healthCheck() {
        return {
            redis: this.redisLimiter !== null,
            memory: true,
            activeBackend: this.redisLimiter ? 'redis' : 'memory',
        };
    }
}
// Singleton instance
let rateLimitingMiddleware = null;
const getRateLimitingMiddleware = () => {
    if (!rateLimitingMiddleware) {
        rateLimitingMiddleware = new RateLimitingMiddleware();
    }
    return rateLimitingMiddleware;
};
exports.getRateLimitingMiddleware = getRateLimitingMiddleware;
const createRateLimitMiddleware = () => {
    const middleware = (0, exports.getRateLimitingMiddleware)();
    return middleware.middleware.bind(middleware);
};
exports.createRateLimitMiddleware = createRateLimitMiddleware;
// Export individual functions for testing and admin operations
const resetRateLimit = async (key) => {
    const middleware = (0, exports.getRateLimitingMiddleware)();
    await middleware.resetKey(key);
};
exports.resetRateLimit = resetRateLimit;
const getRateLimitStatus = async (key) => {
    const middleware = (0, exports.getRateLimitingMiddleware)();
    return await middleware.getStatus(key);
};
exports.getRateLimitStatus = getRateLimitStatus;
const rateLimitHealthCheck = async () => {
    const middleware = (0, exports.getRateLimitingMiddleware)();
    return await middleware.healthCheck();
};
exports.rateLimitHealthCheck = rateLimitHealthCheck;
//# sourceMappingURL=rate-limiting.js.map