"use strict";
/**
 * Metrics event types for performance monitoring and telemetry
 * Generated from JSON Schema contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMetricsEvent = isMetricsEvent;
exports.isAggregatedMetricValue = isAggregatedMetricValue;
exports.createMetricsEvent = createMetricsEvent;
exports.createCounterMetric = createCounterMetric;
exports.createGaugeMetric = createGaugeMetric;
exports.createTimerMetric = createTimerMetric;
exports.isValidMetricName = isValidMetricName;
exports.sanitizeMetricName = sanitizeMetricName;
/**
 * Type guard to check if an event is a metrics event
 */
function isMetricsEvent(event) {
    return /^metrics\.(counter|gauge|histogram|summary)\.(created|updated)$/.test(event.eventType);
}
/**
 * Type guard to check if a metric value is aggregated
 */
function isAggregatedMetricValue(value) {
    return typeof value === 'object' && value !== null && 'sum' in value && 'count' in value;
}
/**
 * Helper to create a metrics event with required fields
 */
function createMetricsEvent(data, baseFields) {
    let eventType;
    // Determine event type based on metric type
    switch (data.type) {
        case 'counter':
            eventType = 'metrics.counter.created';
            break;
        case 'gauge':
            eventType = 'metrics.gauge.created';
            break;
        case 'histogram':
            eventType = 'metrics.histogram.created';
            break;
        case 'summary':
            eventType = 'metrics.summary.created';
            break;
        case 'timer':
            eventType = 'metrics.histogram.created'; // Timers are typically histograms
            break;
        default:
            eventType = 'metrics.gauge.created';
    }
    return {
        ...baseFields,
        eventType,
        data,
    };
}
/**
 * Helper to create a simple counter metric
 */
function createCounterMetric(name, value, dimensions) {
    const metric = {
        name,
        type: 'counter',
        value,
        unit: 'count',
    };
    if (dimensions) {
        metric.dimensions = dimensions;
    }
    return metric;
}
/**
 * Helper to create a gauge metric
 */
function createGaugeMetric(name, value, unit = 'count', dimensions) {
    const metric = {
        name,
        type: 'gauge',
        value,
        unit,
    };
    if (dimensions) {
        metric.dimensions = dimensions;
    }
    return metric;
}
/**
 * Helper to create a timer/duration metric
 */
function createTimerMetric(name, duration, unit = 'milliseconds', dimensions) {
    const metric = {
        name,
        type: 'timer',
        value: duration,
        unit,
    };
    if (dimensions) {
        metric.dimensions = dimensions;
    }
    return metric;
}
/**
 * Validate metric name format (prometheus naming conventions)
 */
function isValidMetricName(name) {
    return /^[a-zA-Z][a-zA-Z0-9._]*$/.test(name) && name.length >= 1 && name.length <= 255;
}
/**
 * Sanitize metric name to follow prometheus conventions
 */
function sanitizeMetricName(name) {
    // Replace invalid characters with underscores
    let sanitized = name.replace(/[^a-zA-Z0-9._]/g, '_');
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = `metric_${sanitized}`;
    }
    // Trim to max length
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
    }
    return sanitized;
}
//# sourceMappingURL=metrics.js.map