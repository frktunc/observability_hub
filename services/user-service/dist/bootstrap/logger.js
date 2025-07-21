"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const observability_1 = require("@observability-hub/observability");
const config_1 = require("@/config");
// Create a single, shared logger instance for the entire service
exports.logger = new observability_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
//# sourceMappingURL=logger.js.map