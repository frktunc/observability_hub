"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTracer = initTracer;
exports.getSdk = getSdk;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
let sdk = null;
function initTracer(config) {
    if (!config.jaegerEnabled) {
        console.log('⚪ Jaeger tracing is disabled.');
        return;
    }
    if (sdk) {
        console.log('⚪ Jaeger tracer already initialized.');
        return;
    }
    const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: config.jaegerEndpoint,
    });
    sdk = new sdk_node_1.NodeSDK({
        resource: new resources_1.Resource({
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
            [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
        }),
        traceExporter,
        instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
    });
    try {
        sdk.start();
        console.log('🟢 Jaeger tracer initialized successfully.');
        // Graceful shutdown
        process.on('SIGTERM', () => {
            sdk?.shutdown().then(() => console.log('🔵 Jaeger tracer terminated.'))
                .catch((error) => console.error('Error terminating Jaeger tracer:', error));
        });
        process.on('SIGINT', () => {
            sdk?.shutdown().then(() => console.log('🔵 Jaeger tracer terminated.'))
                .catch((error) => console.error('Error terminating Jaeger tracer:', error));
        });
    }
    catch (error) {
        console.error('🔴 Failed to initialize Jaeger tracer:', error);
    }
}
function getSdk() {
    return sdk;
}
//# sourceMappingURL=index.js.map