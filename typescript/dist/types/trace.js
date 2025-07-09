"use strict";
/**
 * Trace event types for distributed tracing
 * Generated from JSON Schema contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTraceEvent = isTraceEvent;
exports.isSpanFinished = isSpanFinished;
exports.isSpanSuccessful = isSpanSuccessful;
exports.createTraceEvent = createTraceEvent;
exports.createSpanStartEvent = createSpanStartEvent;
exports.finishSpan = finishSpan;
exports.isValidTraceId = isValidTraceId;
exports.isValidSpanId = isValidSpanId;
exports.generateSpanId = generateSpanId;
exports.generateTraceId = generateTraceId;
exports.calculateSpanDuration = calculateSpanDuration;
exports.addSpanTag = addSpanTag;
exports.addSpanLog = addSpanLog;
/**
 * Type guard to check if an event is a trace event
 */
function isTraceEvent(event) {
    return /^trace\.(span)\.(started|finished|created|updated)$/.test(event.eventType);
}
/**
 * Type guard to check if a span is finished (has endTime)
 */
function isSpanFinished(span) {
    return !!span.endTime;
}
/**
 * Type guard to check if a span is successful (OK status)
 */
function isSpanSuccessful(span) {
    return !span.status || span.status.code === 'OK';
}
/**
 * Helper to create a trace event with required fields
 */
function createTraceEvent(data, baseFields) {
    let eventType;
    // Determine event type based on span state
    if (data.endTime) {
        eventType = 'trace.span.finished';
    }
    else {
        eventType = 'trace.span.started';
    }
    return {
        ...baseFields,
        eventType,
        data,
    };
}
/**
 * Helper to create a span start event
 */
function createSpanStartEvent(traceId, spanId, operationName, parentSpanId, tags) {
    const span = {
        traceId,
        spanId,
        operationName,
    };
    if (parentSpanId) {
        span.parentSpanId = parentSpanId;
    }
    if (tags) {
        span.tags = tags;
    }
    return span;
}
/**
 * Helper to finish a span with status and duration
 */
function finishSpan(span, endTime, status, duration) {
    const finishedSpan = {
        ...span,
        endTime,
    };
    if (status) {
        finishedSpan.status = status;
    }
    if (duration !== undefined) {
        finishedSpan.duration = duration;
    }
    return finishedSpan;
}
/**
 * Validate trace ID format (16 or 32 hex chars)
 */
function isValidTraceId(traceId) {
    return /^[a-f0-9]{32}$|^[a-f0-9]{16}$/i.test(traceId);
}
/**
 * Validate span ID format (16 hex chars)
 */
function isValidSpanId(spanId) {
    return /^[a-f0-9]{16}$/i.test(spanId);
}
/**
 * Generate a random span ID
 */
function generateSpanId() {
    const bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    }
    else {
        // Fallback for environments without crypto.getRandomValues
        for (let i = 0; i < 8; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Generate a random trace ID (32 hex chars)
 */
function generateTraceId() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    }
    else {
        // Fallback for environments without crypto.getRandomValues
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Calculate span duration from start and end times
 */
function calculateSpanDuration(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return (end - start) * 1000; // Convert to microseconds
}
/**
 * Add a tag to a span
 */
function addSpanTag(span, key, value) {
    return {
        ...span,
        tags: {
            ...span.tags,
            [key]: value,
        },
    };
}
/**
 * Add a log entry to a span
 */
function addSpanLog(span, timestamp, fields) {
    const log = { timestamp, fields };
    return {
        ...span,
        logs: [...(span.logs || []), log],
    };
}
//# sourceMappingURL=trace.js.map