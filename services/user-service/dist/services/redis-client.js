"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = exports.initializeRedis = exports.getRedisClient = void 0;
const redis_1 = require("@observability-hub/observability/redis");
const config_1 = require("../config");
const logger_1 = require("../bootstrap/logger");
// Transform config to match observability RedisConfig interface
const redisConfig = {
    host: config_1.derivedConfig.redis.host,
    port: config_1.derivedConfig.redis.port,
    password: config_1.derivedConfig.redis.password,
    db: config_1.derivedConfig.redis.db,
    connectionTimeout: config_1.derivedConfig.redis.connectionTimeout,
    commandTimeout: config_1.derivedConfig.redis.commandTimeout,
    maxRetries: config_1.derivedConfig.redis.retryOptions.maxRetries,
    retryDelay: config_1.derivedConfig.redis.retryOptions.retryDelayMs,
};
// Use observability package's Redis utilities
const redisService = (0, redis_1.createRedisService)(redisConfig, 'user-service', logger_1.logger);
exports.getRedisClient = redisService.getRedisClient, exports.initializeRedis = redisService.initializeRedis, exports.closeRedis = redisService.closeRedis;
//# sourceMappingURL=redis-client.js.map