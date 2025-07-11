"use strict";
// Utility functions for observability setup
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObservabilityFactory = exports.createMonitoringSetup = exports.createCircuitBreakerConfig = void 0;
const createCircuitBreakerConfig = (options = {}) => ({
    enabled: options.enabled ?? true,
    timeout: options.timeout ?? 3000,
    errorThreshold: options.errorThreshold ?? 50,
    resetTimeout: options.resetTimeout ?? 30000,
});
exports.createCircuitBreakerConfig = createCircuitBreakerConfig;
const createMonitoringSetup = (serviceName) => ({
    serviceName,
    metricsEnabled: true,
    healthCheckEnabled: true,
    tracingEnabled: true,
});
exports.createMonitoringSetup = createMonitoringSetup;
const createObservabilityFactory = (serviceName) => ({
    serviceName,
    defaultPorts: {
        api: 8080,
        metrics: 9090,
    },
});
exports.createObservabilityFactory = createObservabilityFactory;
//# sourceMappingURL=index.js.map