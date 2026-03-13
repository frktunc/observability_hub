"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('module-alias/register');
const server_1 = require("./server");
// Initialize Jaeger Tracer before all other imports
/*
initTracer({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  jaegerEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  jaegerEnabled: config.JAEGER_ENABLED,
}, logger);
*/
const server = new server_1.Server();
server.start();
//# sourceMappingURL=index.js.map