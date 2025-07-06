/**
 * Base types for observability events
 * Generated from JSON Schema contracts
 */

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';
export type Environment = 'production' | 'staging' | 'development' | 'testing';

/**
 * Source information about the service that generated the event
 */
export interface EventSource {
  /** Name of the service that generated this event */
  service: string;
  /** Version of the service (semantic versioning) */
  version: string;
  /** Instance ID or hostname */
  instance?: string;
  /** Geographic region or datacenter */
  region?: string;
}

/**
 * Distributed tracing context information
 */
export interface TracingContext {
  /** Distributed tracing trace ID (16 or 32 hex chars) */
  traceId: string;
  /** Distributed tracing span ID (16 hex chars) */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Tracing flags (sampled, debug, etc.) */
  flags?: number;
  /** Tracing baggage key-value pairs */
  baggage?: Record<string, string>;
}

/**
 * Event metadata for processing and categorization
 */
export interface EventMetadata {
  /** Event processing priority */
  priority: EventPriority;
  /** Searchable tags for categorization */
  tags?: string[];
  /** Environment where the event originated */
  environment?: Environment;
  /** Number of retry attempts for this event */
  retryCount?: number;
  /** URL to the schema definition */
  schemaUrl?: string;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Base event interface that all events must implement
 * Provides common fields for correlation, tracing, and metadata
 */
export interface BaseEvent {
  /** Unique identifier for this event (UUID v4) */
  eventId: string;
  /** Event type in format: domain.entity.action */
  eventType: string;
  /** Schema version (semantic versioning) */
  version: string;
  /** RFC 3339 timestamp when the event occurred */
  timestamp: string;
  /** Correlation ID for tracking related events across services */
  correlationId: string;
  /** ID of the event that caused this event (for event sourcing) */
  causationId?: string;
  /** Source information about the service */
  source: EventSource;
  /** Distributed tracing context */
  tracing?: TracingContext;
  /** Event metadata */
  metadata: EventMetadata;
}

/**
 * Event type patterns for validation
 */
export const EVENT_TYPE_PATTERNS = {
  LOG: /^log\.(message|error|warning|info|debug)\.(created|updated)$/,
  METRICS: /^metrics\.(counter|gauge|histogram|summary)\.(created|updated)$/,
  TRACE: /^trace\.(span)\.(started|finished|created|updated)$/,
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors?: ValidationError[];
}

/**
 * Detailed validation error information
 */
export interface ValidationError {
  /** Field path where the error occurred */
  field: string;
  /** Error message */
  message: string;
  /** The invalid value */
  value?: unknown;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Event versioning information
 */
export interface EventVersion {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
}

/**
 * Parse semantic version string into components
 */
export function parseVersion(version: string): EventVersion | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Check if two versions are compatible (same major version)
 */
export function isVersionCompatible(v1: string, v2: string): boolean {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);
  
  if (!version1 || !version2) return false;
  
  return version1.major === version2.major;
}

/**
 * Current schema versions
 */
export const SCHEMA_VERSIONS = {
  BASE_EVENT: '1.0.0',
  LOG_EVENT: '1.0.0',
  METRICS_EVENT: '1.0.0',
  TRACE_EVENT: '1.0.0',
} as const; 