/**
 * Simplified event validator for observability events
 * Provides basic validation without external dependencies
 */

import { ValidationResult, ValidationError, EVENT_TYPE_PATTERNS } from '../types/base';

/**
 * Validation rules for event fields
 */
const VALIDATION_RULES = {
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ISO_DATE_PATTERN: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
  SEMVER_PATTERN: /^\d+\.\d+\.\d+$/,
  TRACE_ID_PATTERN: /^[a-f0-9]{16}$|^[a-f0-9]{32}$/,
  SPAN_ID_PATTERN: /^[a-f0-9]{16}$/,
} as const;

/**
 * Performance metrics for validation
 */
interface ValidationMetrics {
  totalValidations: number;
  totalTime: number;
  averageTime: number;
  successRate: number;
}

/**
 * Simplified event validator class
 */
export class SimpleEventValidator {
  private metrics: ValidationMetrics = {
    totalValidations: 0,
    totalTime: 0,
    averageTime: 0,
    successRate: 0,
  };
  private successfulValidations = 0;

  /**
   * Validate any event structure
   */
  public validate(data: unknown): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];

    try {
      // Basic structure validation
      if (!this.isValidObject(data)) {
        errors.push({
          field: 'root',
          message: 'Event must be a valid object',
        });
        return this.createResult(false, errors, startTime);
      }

      const event = data as Record<string, unknown>;

      // Validate base event fields
      this.validateBaseEvent(event, errors);

      // Validate specific event type if possible
      if (event.eventType && typeof event.eventType === 'string') {
        this.validateEventType(event, errors);
      }

      const isValid = errors.length === 0;
      if (isValid) {
        this.successfulValidations++;
      }

      return this.createResult(isValid, errors, startTime);
    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Validation failed: ${String(error)}`,
      });
      return this.createResult(false, errors, startTime);
    }
  }

  /**
   * Validate multiple events in batch
   */
  public validateBatch(events: unknown[]): ValidationResult[] {
    return events.map(event => this.validate(event));
  }

  /**
   * Check if value is a valid object
   */
  private isValidObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Validate base event structure
   */
  private validateBaseEvent(event: Record<string, unknown>, errors: ValidationError[]): void {
    // Required fields
    const requiredFields = ['eventId', 'eventType', 'version', 'timestamp', 'correlationId', 'source', 'metadata'];
    
    for (const field of requiredFields) {
      if (!(field in event) || event[field] === undefined || event[field] === null) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          value: event[field],
        });
      }
    }

    // Validate field formats
    if (event.eventId && typeof event.eventId === 'string') {
      if (!VALIDATION_RULES.UUID_PATTERN.test(event.eventId)) {
        errors.push({
          field: 'eventId',
          message: 'eventId must be a valid UUID',
          value: event.eventId,
        });
      }
    }

    if (event.correlationId && typeof event.correlationId === 'string') {
      if (!VALIDATION_RULES.UUID_PATTERN.test(event.correlationId)) {
        errors.push({
          field: 'correlationId',
          message: 'correlationId must be a valid UUID',
          value: event.correlationId,
        });
      }
    }

    if (event.timestamp && typeof event.timestamp === 'string') {
      if (!VALIDATION_RULES.ISO_DATE_PATTERN.test(event.timestamp)) {
        errors.push({
          field: 'timestamp',
          message: 'timestamp must be a valid ISO 8601 date',
          value: event.timestamp,
        });
      }
    }

    if (event.version && typeof event.version === 'string') {
      if (!VALIDATION_RULES.SEMVER_PATTERN.test(event.version)) {
        errors.push({
          field: 'version',
          message: 'version must follow semantic versioning (x.y.z)',
          value: event.version,
        });
      }
    }

    // Validate source object
    if (event.source) {
      this.validateSource(event.source, errors);
    }

    // Validate metadata object
    if (event.metadata) {
      this.validateMetadata(event.metadata, errors);
    }

    // Validate tracing context if present
    if (event.tracing) {
      this.validateTracing(event.tracing, errors);
    }
  }

  /**
   * Validate source object
   */
  private validateSource(source: unknown, errors: ValidationError[]): void {
    if (!this.isValidObject(source)) {
      errors.push({
        field: 'source',
        message: 'source must be an object',
        value: source,
      });
      return;
    }

    const sourceObj = source as Record<string, unknown>;

    if (!sourceObj.service || typeof sourceObj.service !== 'string') {
      errors.push({
        field: 'source.service',
        message: 'source.service is required and must be a string',
        value: sourceObj.service,
      });
    }

    if (!sourceObj.version || typeof sourceObj.version !== 'string') {
      errors.push({
        field: 'source.version',
        message: 'source.version is required and must be a string',
        value: sourceObj.version,
      });
    } else if (!VALIDATION_RULES.SEMVER_PATTERN.test(sourceObj.version)) {
      errors.push({
        field: 'source.version',
        message: 'source.version must follow semantic versioning',
        value: sourceObj.version,
      });
    }
  }

  /**
   * Validate metadata object
   */
  private validateMetadata(metadata: unknown, errors: ValidationError[]): void {
    if (!this.isValidObject(metadata)) {
      errors.push({
        field: 'metadata',
        message: 'metadata must be an object',
        value: metadata,
      });
      return;
    }

    const metadataObj = metadata as Record<string, unknown>;

    if (!metadataObj.priority || typeof metadataObj.priority !== 'string') {
      errors.push({
        field: 'metadata.priority',
        message: 'metadata.priority is required and must be a string',
        value: metadataObj.priority,
      });
    } else {
      const validPriorities = ['critical', 'high', 'normal', 'low'];
      if (!validPriorities.includes(metadataObj.priority)) {
        errors.push({
          field: 'metadata.priority',
          message: `metadata.priority must be one of: ${validPriorities.join(', ')}`,
          value: metadataObj.priority,
        });
      }
    }
  }

  /**
   * Validate tracing context
   */
  private validateTracing(tracing: unknown, errors: ValidationError[]): void {
    if (!this.isValidObject(tracing)) {
      errors.push({
        field: 'tracing',
        message: 'tracing must be an object',
        value: tracing,
      });
      return;
    }

    const tracingObj = tracing as Record<string, unknown>;

    if (!tracingObj.traceId || typeof tracingObj.traceId !== 'string') {
      errors.push({
        field: 'tracing.traceId',
        message: 'tracing.traceId is required and must be a string',
        value: tracingObj.traceId,
      });
    } else if (!VALIDATION_RULES.TRACE_ID_PATTERN.test(tracingObj.traceId)) {
      errors.push({
        field: 'tracing.traceId',
        message: 'tracing.traceId must be a valid trace ID (16 or 32 hex chars)',
        value: tracingObj.traceId,
      });
    }

    if (tracingObj.spanId && typeof tracingObj.spanId === 'string') {
      if (!VALIDATION_RULES.SPAN_ID_PATTERN.test(tracingObj.spanId)) {
        errors.push({
          field: 'tracing.spanId',
          message: 'tracing.spanId must be a valid span ID (16 hex chars)',
          value: tracingObj.spanId,
        });
      }
    }
  }

  /**
   * Validate event type specific rules
   */
  private validateEventType(event: Record<string, unknown>, errors: ValidationError[]): void {
    const eventType = event.eventType as string;

    // Check if event type matches known patterns
    const patterns = Object.values(EVENT_TYPE_PATTERNS);
    const isValidPattern = patterns.some(pattern => pattern.test(eventType));

    if (!isValidPattern) {
      errors.push({
        field: 'eventType',
        message: 'eventType does not match any known patterns',
        value: eventType,
      });
      return;
    }

    // Validate data field based on event type
    if (eventType.startsWith('log.')) {
      this.validateLogEventData(event, errors);
    } else if (eventType.startsWith('metrics.')) {
      this.validateMetricsEventData(event, errors);
    } else if (eventType.startsWith('trace.')) {
      this.validateTraceEventData(event, errors);
    }
  }

  /**
   * Validate log event data
   */
  private validateLogEventData(event: Record<string, unknown>, errors: ValidationError[]): void {
    if (!event.data || !this.isValidObject(event.data)) {
      errors.push({
        field: 'data',
        message: 'Log events must have a data object',
        value: event.data,
      });
      return;
    }

    const data = event.data as Record<string, unknown>;

    // Required fields for log events
    const requiredLogFields = ['level', 'message', 'timestamp'];
    for (const field of requiredLogFields) {
      if (!data[field]) {
        errors.push({
          field: `data.${field}`,
          message: `Log event data.${field} is required`,
          value: data[field],
        });
      }
    }

    // Validate log level
    if (data.level && typeof data.level === 'string') {
      const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
      if (!validLevels.includes(data.level)) {
        errors.push({
          field: 'data.level',
          message: `data.level must be one of: ${validLevels.join(', ')}`,
          value: data.level,
        });
      }
    }
  }

  /**
   * Validate metrics event data
   */
  private validateMetricsEventData(event: Record<string, unknown>, errors: ValidationError[]): void {
    if (!event.data || !this.isValidObject(event.data)) {
      errors.push({
        field: 'data',
        message: 'Metrics events must have a data object',
        value: event.data,
      });
      return;
    }

    const data = event.data as Record<string, unknown>;

    // Required fields for metrics events
    const requiredMetricsFields = ['name', 'type', 'value', 'unit', 'timestamp'];
    for (const field of requiredMetricsFields) {
      if (!data[field]) {
        errors.push({
          field: `data.${field}`,
          message: `Metrics event data.${field} is required`,
          value: data[field],
        });
      }
    }
  }

  /**
   * Validate trace event data
   */
  private validateTraceEventData(event: Record<string, unknown>, errors: ValidationError[]): void {
    if (!event.data || !this.isValidObject(event.data)) {
      errors.push({
        field: 'data',
        message: 'Trace events must have a data object',
        value: event.data,
      });
      return;
    }

    const data = event.data as Record<string, unknown>;

    // Required fields for trace events
    const requiredTraceFields = ['traceId', 'spanId', 'operationName', 'startTime'];
    for (const field of requiredTraceFields) {
      if (!data[field]) {
        errors.push({
          field: `data.${field}`,
          message: `Trace event data.${field} is required`,
          value: data[field],
        });
      }
    }
  }

  /**
   * Create validation result with metrics update
   */
  private createResult(valid: boolean, errors: ValidationError[], startTime: number): ValidationResult {
    const endTime = Date.now();
    const validationTime = endTime - startTime;

    // Update metrics
    this.metrics.totalValidations++;
    this.metrics.totalTime += validationTime;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalValidations;
    this.metrics.successRate = this.successfulValidations / this.metrics.totalValidations;

    const result: ValidationResult = { valid };
    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  }

  /**
   * Get current validation metrics
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset validation metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      totalTime: 0,
      averageTime: 0,
      successRate: 0,
    };
    this.successfulValidations = 0;
  }

  /**
   * Check if validator can handle target throughput
   */
  public canHandleThroughput(targetThroughput: number): boolean {
    if (this.metrics.totalValidations === 0) return false;
    const currentThroughput = 1000 / this.metrics.averageTime; // validations per second
    return currentThroughput >= targetThroughput;
  }
}

/**
 * Singleton validator instance
 */
let globalValidator: SimpleEventValidator | null = null;

/**
 * Get the global validator instance
 */
export function getSimpleValidator(): SimpleEventValidator {
  if (!globalValidator) {
    globalValidator = new SimpleEventValidator();
  }
  return globalValidator;
}

/**
 * Convenience function to validate a single event
 */
export function validateEvent(data: unknown): ValidationResult {
  return getSimpleValidator().validate(data);
}

/**
 * Convenience function to validate multiple events
 */
export function validateEvents(events: unknown[]): ValidationResult[] {
  return getSimpleValidator().validateBatch(events);
} 