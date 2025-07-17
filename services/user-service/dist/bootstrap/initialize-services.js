"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeServices = initializeServices;
const config_1 = require("../config");
const redis_client_1 = require("../services/redis-client");
async function initializeServices() {
    try {
        if (config_1.derivedConfig.redis.rateLimiting.enabled) {
            await (0, redis_client_1.initializeRedis)();
            console.log('🎯 Redis services initialized successfully');
        }
        else {
            console.log('⚠️ Redis rate limiting disabled, using memory fallback');
        }
    }
    catch (error) {
        console.error('❌ Failed to initialize Redis, falling back to memory rate limiting:', error);
        // Don't throw error - let the app continue with memory fallback
    }
}
//# sourceMappingURL=initialize-services.js.map