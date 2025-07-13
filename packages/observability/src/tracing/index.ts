import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

interface TracerConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint: string;
  jaegerEnabled: boolean;
}

let sdk: NodeSDK | null = null;

export function initTracer(config: TracerConfig): void {
  if (!config.jaegerEnabled) {
    console.log('⚪ Jaeger tracing is disabled.');
    return;
  }

  if (sdk) {
    console.log('⚪ Jaeger tracer already initialized.');
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: config.jaegerEndpoint,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
    }),
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
    console.log('🟢 Jaeger tracer initialized successfully.');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk?.shutdown().then(() => console.log('🔵 Jaeger tracer terminated.'))
        .catch((error: Error) => console.error('Error terminating Jaeger tracer:', error));
    });
    process.on('SIGINT', () => {
      sdk?.shutdown().then(() => console.log('🔵 Jaeger tracer terminated.'))
        .catch((error: Error) => console.error('Error terminating Jaeger tracer:', error));
    });

  } catch (error) {
    console.error('🔴 Failed to initialize Jaeger tracer:', error as Error);
  }
}

export function getSdk(): NodeSDK | null {
    return sdk;
}
