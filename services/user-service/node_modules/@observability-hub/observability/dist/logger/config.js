"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultConfig = createDefaultConfig;
const types_1 = require("./types");
function createDefaultConfig(config) {
    return {
        ...config,
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion || '1.0.0',
        environment: config.environment || 'development',
        rabbitmqHostname: config.rabbitmqHostname || 'obs_rabbitmq',
        rabbitmqPort: config.rabbitmqPort || 5672,
        rabbitmqVhost: config.rabbitmqVhost || '/',
        rabbitmqExchange: config.rabbitmqExchange || 'logs.topic',
        connectionTimeout: config.connectionTimeout || 30000,
        heartbeat: config.heartbeat || 60,
        maxRetries: config.maxRetries || 5,
        retryDelayMs: config.retryDelayMs || 2000,
        defaultLogLevel: config.defaultLogLevel || types_1.LogLevel.INFO,
        enableBatching: config.enableBatching || false,
        batchSize: config.batchSize || 100,
        batchTimeoutMs: config.batchTimeoutMs || 5000,
        enableCircuitBreaker: config.enableCircuitBreaker || true,
        circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
        circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
    };
}
//# sourceMappingURL=config.js.map