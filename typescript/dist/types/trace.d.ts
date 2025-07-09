/**
 * Trace event types for distributed tracing
 * Generated from JSON Schema contracts
 */
import { BaseEvent } from './base';
export type SpanStatusCode = 'OK' | 'CANCELLED' | 'UNKNOWN' | 'INVALID_ARGUMENT' | 'DEADLINE_EXCEEDED' | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'PERMISSION_DENIED' | 'RESOURCE_EXHAUSTED' | 'FAILED_PRECONDITION' | 'ABORTED' | 'OUT_OF_RANGE' | 'UNIMPLEMENTED' | 'INTERNAL' | 'UNAVAILABLE' | 'DATA_LOSS' | 'UNAUTHENTICATED';
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
export type SpanReferenceType = 'CHILD_OF' | 'FOLLOWS_FROM';
export type TraceEventType = 'trace.span.started' | 'trace.span.finished' | 'trace.span.created' | 'trace.span.updated';
/**
 * Span status information following gRPC conventions
 */
export interface SpanStatus {
    /** Span status code */
    code: SpanStatusCode;
    /** Status message */
    message?: string;
}
/**
 * Span tag/attribute value types
 */
export type SpanTagValue = string | number | boolean;
/**
 * Structured log entry within a span
 */
export interface SpanLog {
    /** Timestamp when the log was recorded */
    timestamp: string;
    /** Log fields/data */
    fields?: Record<string, SpanTagValue>;
}
/**
 * Process information for the span
 */
export interface SpanProcess {
    /** Service name */
    serviceName: string;
    /** Process-level tags */
    tags?: Record<string, string>;
}
/**
 * Reference to another span
 */
export interface SpanReference {
    /** Type of reference */
    refType: SpanReferenceType;
    /** Referenced trace ID */
    traceId: string;
    /** Referenced span ID */
    spanId: string;
}
/**
 * Trace event data payload
 */
export interface TraceEventData {
    /** Unique identifier for the entire trace */
    traceId: string;
    /** Unique identifier for this span */
    spanId: string;
    /** Parent span identifier */
    parentSpanId?: string;
    /** Name of the operation being traced */
    operationName: string;
    /** When the span started */
    startTime: string;
    /** When the span ended */
    endTime?: string;
    /** Span duration in microseconds */
    duration?: number;
    /** Span status */
    status?: SpanStatus;
    /** Span kind indicating the type of span */
    kind?: SpanKind;
    /** Span tags/attributes for additional metadata */
    tags?: Record<string, SpanTagValue>;
    /** Structured logs within the span */
    logs?: SpanLog[];
    /** Process information */
    process?: SpanProcess;
    /** References to other spans */
    references?: SpanReference[];
}
/**
 * Complete trace event interface
 */
export interface TraceEvent extends BaseEvent {
    eventType: TraceEventType;
    data: TraceEventData;
}
/**
 * Type guard to check if an event is a trace event
 */
export declare function isTraceEvent(event: BaseEvent): event is TraceEvent;
/**
 * Type guard to check if a span is finished (has endTime)
 */
export declare function isSpanFinished(span: TraceEventData): boolean;
/**
 * Type guard to check if a span is successful (OK status)
 */
export declare function isSpanSuccessful(span: TraceEventData): boolean;
/**
 * Helper to create a trace event with required fields
 */
export declare function createTraceEvent(data: TraceEventData, baseFields: Omit<BaseEvent, 'eventType' | 'data'>): TraceEvent;
/**
 * Helper to create a span start event
 */
export declare function createSpanStartEvent(traceId: string, spanId: string, operationName: string, parentSpanId?: string, tags?: Record<string, SpanTagValue>): Omit<TraceEventData, 'startTime'>;
/**
 * Helper to finish a span with status and duration
 */
export declare function finishSpan(span: TraceEventData, endTime: string, status?: SpanStatus, duration?: number): TraceEventData;
/**
 * Validate trace ID format (16 or 32 hex chars)
 */
export declare function isValidTraceId(traceId: string): boolean;
/**
 * Validate span ID format (16 hex chars)
 */
export declare function isValidSpanId(spanId: string): boolean;
/**
 * Generate a random span ID
 */
export declare function generateSpanId(): string;
/**
 * Generate a random trace ID (32 hex chars)
 */
export declare function generateTraceId(): string;
/**
 * Calculate span duration from start and end times
 */
export declare function calculateSpanDuration(startTime: string, endTime: string): number;
/**
 * Add a tag to a span
 */
export declare function addSpanTag(span: TraceEventData, key: string, value: SpanTagValue): TraceEventData;
/**
 * Add a log entry to a span
 */
export declare function addSpanLog(span: TraceEventData, timestamp: string, fields: Record<string, SpanTagValue>): TraceEventData;
//# sourceMappingURL=trace.d.ts.map