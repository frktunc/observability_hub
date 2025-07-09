/**
 * Main exports for @observability-hub/event-contracts
 * TypeScript types and validators for observability events
 */
export * from './types/base';
export * from './types/log';
export * from './types/metrics';
export * from './types/trace';
export * from './validators/schema-validator';
export * from './validators/simple-validator';
export { EventValidator, getValidator, validateEvent, validateEvents, resetGlobalValidator } from './validators/schema-validator';
export type { BaseEvent, EventSource, TracingContext, EventMetadata, ValidationResult, ValidationError, EventVersion, EventPriority, Environment } from './types/base';
export type { LogEvent, LogEventData, LogLevel, LogEventType, LoggerInfo, LogContext, LogMetrics, StructuredLogData, LogErrorInfo, LogSourceInfo } from './types/log';
export type { MetricsEvent, MetricsEventData, MetricType, MetricUnit, MetricsEventType, HistogramBucket, MetricExemplar, AggregatedMetricValue, MetricValue } from './types/metrics';
export type { TraceEvent, TraceEventData, SpanStatusCode, SpanKind, SpanReferenceType, TraceEventType, SpanStatus, SpanTagValue, SpanLog, SpanProcess, SpanReference } from './types/trace';
export type { ValidatorOptions, SchemaType, ValidationMetrics } from './validators/schema-validator';
export declare const VERSION = "1.0.0";
export declare const SCHEMA_VERSIONS: {
    readonly BASE_EVENT: "1.0.0";
    readonly LOG_EVENT: "1.0.0";
    readonly METRICS_EVENT: "1.0.0";
    readonly TRACE_EVENT: "1.0.0";
};
//# sourceMappingURL=index.d.ts.map