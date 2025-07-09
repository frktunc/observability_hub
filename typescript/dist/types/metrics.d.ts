/**
 * Metrics event types for performance monitoring and telemetry
 * Generated from JSON Schema contracts
 */
import { BaseEvent } from './base';
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'timer';
export type MetricUnit = 'bytes' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' | 'percent' | 'ratio' | 'count' | 'requests' | 'errors' | 'operations';
export type MetricsEventType = 'metrics.counter.created' | 'metrics.counter.updated' | 'metrics.gauge.created' | 'metrics.gauge.updated' | 'metrics.histogram.created' | 'metrics.histogram.updated' | 'metrics.summary.created' | 'metrics.summary.updated';
/**
 * Histogram bucket for distribution metrics
 */
export interface HistogramBucket {
    /** Upper bound of the bucket */
    upperBound: number;
    /** Number of observations in this bucket */
    count: number;
}
/**
 * Metric exemplar linking metrics to traces
 */
export interface MetricExemplar {
    /** Exemplar value */
    value: number;
    /** Timestamp when exemplar was recorded */
    timestamp: string;
    /** Distributed tracing trace ID */
    traceId?: string;
    /** Distributed tracing span ID */
    spanId?: string;
    /** Additional labels for the exemplar */
    labels?: Record<string, string>;
}
/**
 * Complex metric value for aggregated metrics (histogram, summary)
 */
export interface AggregatedMetricValue {
    /** Sum of all values */
    sum: number;
    /** Count of observations */
    count: number;
    /** Minimum value */
    min?: number;
    /** Maximum value */
    max?: number;
    /** Average value */
    avg?: number;
    /** Percentile values */
    percentiles?: {
        p50?: number;
        p90?: number;
        p95?: number;
        p99?: number;
    };
}
/**
 * Metric value - can be simple number or complex aggregation
 */
export type MetricValue = number | AggregatedMetricValue;
/**
 * Metrics event data payload
 */
export interface MetricsEventData {
    /** Metric name following prometheus naming conventions */
    name: string;
    /** Type of metric */
    type: MetricType;
    /** Metric value - can be simple number or complex aggregation */
    value: MetricValue;
    /** Unit of measurement */
    unit: MetricUnit;
    /** When the metric was collected */
    timestamp: string;
    /** Metric dimensions/labels for grouping and filtering */
    dimensions?: Record<string, string>;
    /** Histogram buckets (for histogram metrics) */
    buckets?: HistogramBucket[];
    /** Exemplars linking metrics to traces */
    exemplars?: MetricExemplar[];
}
/**
 * Complete metrics event interface
 */
export interface MetricsEvent extends BaseEvent {
    eventType: MetricsEventType;
    data: MetricsEventData;
}
/**
 * Type guard to check if an event is a metrics event
 */
export declare function isMetricsEvent(event: BaseEvent): event is MetricsEvent;
/**
 * Type guard to check if a metric value is aggregated
 */
export declare function isAggregatedMetricValue(value: MetricValue): value is AggregatedMetricValue;
/**
 * Helper to create a metrics event with required fields
 */
export declare function createMetricsEvent(data: MetricsEventData, baseFields: Omit<BaseEvent, 'eventType' | 'data'>): MetricsEvent;
/**
 * Helper to create a simple counter metric
 */
export declare function createCounterMetric(name: string, value: number, dimensions?: Record<string, string>): Omit<MetricsEventData, 'timestamp'>;
/**
 * Helper to create a gauge metric
 */
export declare function createGaugeMetric(name: string, value: number, unit?: MetricUnit, dimensions?: Record<string, string>): Omit<MetricsEventData, 'timestamp'>;
/**
 * Helper to create a timer/duration metric
 */
export declare function createTimerMetric(name: string, duration: number, unit?: 'milliseconds' | 'seconds' | 'microseconds' | 'nanoseconds', dimensions?: Record<string, string>): Omit<MetricsEventData, 'timestamp'>;
/**
 * Validate metric name format (prometheus naming conventions)
 */
export declare function isValidMetricName(name: string): boolean;
/**
 * Sanitize metric name to follow prometheus conventions
 */
export declare function sanitizeMetricName(name: string): string;
//# sourceMappingURL=metrics.d.ts.map