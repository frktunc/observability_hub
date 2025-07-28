require('module-alias/register');
import { initTracer } from '@observability-hub/observability';
import { config } from './config';
import { Server } from './server';
import { logger } from './bootstrap/logger';

// Initialize Jaeger Tracer before all other imports
initTracer({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  jaegerEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  jaegerEnabled: config.JAEGER_ENABLED,
}, logger);

const server = new Server();
server.start();
