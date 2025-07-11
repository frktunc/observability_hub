"use strict";
// ==============================================
// @observability-hub/observability
// Complete Observability Solution for Microservices
// ==============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObservabilitySetup = exports.createReadinessCheckHandler = exports.createHealthCheckHandler = exports.createRedisService = exports.createRedisClient = exports.RedisClient = exports.serviceConfigs = exports.createDerivedConfig = exports.createObservabilityConfigSchema = exports.ObservabilityLogger = void 0;
// ===== LOGGER EXPORTS =====
var logger_1 = require("./logger/logger");
Object.defineProperty(exports, "ObservabilityLogger", { enumerable: true, get: function () { return logger_1.ObservabilityLogger; } });
// ===== CONFIGURATION EXPORTS =====
var config_1 = require("./config");
Object.defineProperty(exports, "createObservabilityConfigSchema", { enumerable: true, get: function () { return config_1.createObservabilityConfigSchema; } });
Object.defineProperty(exports, "createDerivedConfig", { enumerable: true, get: function () { return config_1.createDerivedConfig; } });
Object.defineProperty(exports, "serviceConfigs", { enumerable: true, get: function () { return config_1.serviceConfigs; } });
// ===== REDIS EXPORTS =====
var redis_1 = require("./redis");
Object.defineProperty(exports, "RedisClient", { enumerable: true, get: function () { return redis_1.RedisClient; } });
Object.defineProperty(exports, "createRedisClient", { enumerable: true, get: function () { return redis_1.createRedisClient; } });
Object.defineProperty(exports, "createRedisService", { enumerable: true, get: function () { return redis_1.createRedisService; } });
// ===== HEALTH CHECK EXPORTS =====
var health_1 = require("./health");
Object.defineProperty(exports, "createHealthCheckHandler", { enumerable: true, get: function () { return health_1.createHealthCheckHandler; } });
Object.defineProperty(exports, "createReadinessCheckHandler", { enumerable: true, get: function () { return health_1.createReadinessCheckHandler; } });
// ===== FACTORY FUNCTION =====
const logger_2 = require("./logger/logger");
const redis_2 = require("./redis");
const health_2 = require("./health");
const config_2 = require("./config");
const createObservabilitySetup = (serviceName, config = {}) => {
    return {
        logger: new logger_2.ObservabilityLogger({
            serviceName,
            serviceVersion: config.serviceVersion || '1.0.0',
            environment: config.environment || 'development',
            ...config.logger
        }),
        redis: config.redis ? (0, redis_2.createRedisService)(config.redis, serviceName) : null,
        healthCheck: (0, health_2.createHealthCheckHandler)(serviceName, config.serviceVersion || '1.0.0', {} // Will be filled by service implementation
        ),
        config: (0, config_2.createObservabilityConfigSchema)(serviceName, 8080, 9090)
    };
};
exports.createObservabilitySetup = createObservabilitySetup;
// ===== DEFAULT EXPORTS =====
exports.default = {
    ObservabilityLogger: logger_2.ObservabilityLogger,
    createObservabilityConfigSchema: config_2.createObservabilityConfigSchema,
    createRedisClient: require('./redis').createRedisClient,
    createHealthCheckHandler: health_2.createHealthCheckHandler,
    createObservabilitySetup: exports.createObservabilitySetup
};
//# sourceMappingURL=index.js.map