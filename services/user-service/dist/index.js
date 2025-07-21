"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('module-alias/register');
const observability_1 = require("@observability-hub/observability");
const config_1 = require("@/config");
const server_1 = require("@/server");
const logger_1 = require("./bootstrap/logger");
// Initialize Jaeger Tracer before all other imports
(0, observability_1.initTracer)({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    jaegerEndpoint: config_1.config.OTEL_EXPORTER_OTLP_ENDPOINT,
    jaegerEnabled: config_1.config.JAEGER_ENABLED,
}, logger_1.logger);
const server = new server_1.Server();
server.start();
//# sourceMappingURL=index.js.map