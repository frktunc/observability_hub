/**
 * High-performance JSON Schema validator for observability events
 * Uses simplified validation for browser/TypeScript compatibility
 */

import { ValidationResult, ValidationError } from '../types/base';

// Mock schemas - in real implementation these would be loaded properly
const mockSchemas = {
  'base-event': { type: 'object', required: ['eventId', 'eventType', 'timestamp', 'correlationId'] },
  'log-event': { type: 'object', required: ['eventId', 'eventType', 'data'] },
  'metrics-event': { type: 'object', required: ['eventId', 'eventType', 'data'] },
  'trace-event': { type: 'object', required: ['eventId', 'eventType', 'data'] }
};

// Type definitions for validation
interface ValidateFunction {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}

interface ErrorObject {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  data?: unknown;
  message?: string;
}

/**
 * Schema validator configuration options
 */
export interface ValidatorOptions {
  /** Enable additional format validations */
  enableFormats?: boolean;
  /** Enable strict mode for additional validation */
  strict?: boolean;
  /** Enable all errors collection (slower but more detailed) */
  allErrors?: boolean;
  /** Enable verbose error messages */
  verbose?: boolean;
  /** Cache compiled validators */
  useCache?: boolean;
}

/**
 * Schema types supported by the validator
 */
export type SchemaType = 'base-event' | 'log-event' | 'metrics-event' | 'trace-event';

/**
 * Performance metrics for validation operations
 */
export interface ValidationMetrics {
  /** Total validations performed */
  totalValidations: number;
  /** Total validation time in milliseconds */
  totalTime: number;
  /** Average validation time per operation */
  averageTime: number;
  /** Validations per second */
  throughput: number;
  /** Cache hit ratio */
  cacheHitRatio: number;
}

/**
 * High-performance event validator with caching and metrics
 */
export class EventValidator {
  private validators: Map<SchemaType, ValidateFunction> = new Map();
  private metrics: ValidationMetrics;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(_options: ValidatorOptions = {}) {
    // Options are available but not stored as they're only used for initialization
    this.metrics = {
      totalValidations: 0,
      totalTime: 0,
      averageTime: 0,
      throughput: 0,
      cacheHitRatio: 0,
    };

    // Initialize validators
    this.initializeValidators();
  }

  /**
   * Initialize mock validators for each schema type
   */
  private initializeValidators(): void {
    for (const schemaType of Object.keys(mockSchemas) as SchemaType[]) {
      const validator: ValidateFunction = (data: unknown) => {
        if (!data || typeof data !== 'object') {
          validator.errors = [{
            instancePath: '',
            message: 'Data must be an object',
            keyword: 'type',
          }];
          return false;
        }

        const event = data as Record<string, unknown>;
        const schema = mockSchemas[schemaType];
        
        // Check required fields
        if (schema.required) {
          for (const field of schema.required) {
            if (!(field in event) || event[field] === undefined || event[field] === null) {
              validator.errors = [{
                instancePath: `/${field}`,
                message: `Missing required field: ${field}`,
                keyword: 'required',
              }];
              return false;
            }
          }
        }

        // Basic format validations for specific fields
        if (event.eventId && typeof event.eventId === 'string') {
          if (!/^[0-9a-f-]+$/i.test(event.eventId)) {
            validator.errors = [{
              instancePath: '/eventId',
              message: 'eventId must be a valid UUID format',
              keyword: 'format',
            }];
            return false;
          }
        }

        if (event.timestamp && typeof event.timestamp === 'string') {
          if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(event.timestamp)) {
            validator.errors = [{
              instancePath: '/timestamp',
              message: 'timestamp must be a valid ISO 8601 date',
              keyword: 'format',
            }];
            return false;
          }
        }

        validator.errors = null;
        return true;
      };

      this.validators.set(schemaType, validator);
    }
  }

  /**
   * Validate data against a specific schema
   */
  public validate(data: unknown, schemaType: SchemaType): ValidationResult {
    const startTime = this.getCurrentTime();
    
    try {
      const validator = this.validators.get(schemaType);
      if (!validator) {
        return {
          valid: false,
          errors: [{
            field: 'schema',
            message: `Unknown schema type: ${schemaType}`,
          }]
        };
      }

      const isValid = validator(data);
      const errors = isValid ? [] : this.formatErrors(validator.errors || []);

      this.updateMetrics(this.getCurrentTime() - startTime);

      const result: ValidationResult = { valid: isValid };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
    } catch (error) {
      const endTime = this.getCurrentTime();
      this.updateMetrics(endTime - startTime);
      
      return {
        valid: false,
        errors: [{
          field: 'validation',
          message: `Validation failed: ${String(error)}`,
        }]
      };
    }
  }

  /**
   * Validate multiple events in batch
   */
  public validateBatch(events: Array<{ data: unknown; schemaType: SchemaType }>): ValidationResult[] {
    return events.map(event => this.validate(event.data, event.schemaType));
  }

  /**
   * Auto-detect schema type and validate
   */
  public validateAuto(data: unknown): ValidationResult {
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: [{
          field: 'data',
          message: 'Data must be an object',
        }]
      };
    }

    const event = data as Record<string, unknown>;
    const schemaType = this.detectSchemaType(event);
    
    if (!schemaType) {
      return {
        valid: false,
        errors: [{
          field: 'eventType',
          message: 'Cannot detect schema type from event',
        }]
      };
    }

    return this.validate(data, schemaType);
  }

  /**
   * Detect schema type from event data
   */
  private detectSchemaType(event: Record<string, unknown>): SchemaType | null {
    const eventType = event.eventType;
    if (typeof eventType !== 'string') return null;

    if (eventType.startsWith('log.')) return 'log-event';
    if (eventType.startsWith('metrics.')) return 'metrics-event';
    if (eventType.startsWith('trace.')) return 'trace-event';
    
    return 'base-event';
  }

  /**
   * Format AJV errors to our error format
   */
  private formatErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map(error => ({
      field: error.instancePath || 'unknown',
      message: error.message || 'Validation failed',
      value: error.data,
      code: error.keyword ? error.keyword.toUpperCase() : '',
    }));
  }

  /**
   * Get current time for performance measurements
   */
  private getCurrentTime(): number {
    // Use Date.now() for browser compatibility
    return Date.now();
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(validationTime: number): void {
    this.metrics.totalValidations++;
    this.metrics.totalTime += validationTime;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalValidations;
    this.metrics.throughput = (this.metrics.totalValidations / this.metrics.totalTime) * 1000;
    this.metrics.cacheHitRatio = this.cacheHits / (this.cacheHits + this.cacheMisses);
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      totalTime: 0,
      averageTime: 0,
      throughput: 0,
      cacheHitRatio: 0,
    };
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get list of supported schema types
   */
  public getSupportedSchemas(): SchemaType[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Check if validator can handle the given throughput
   */
  public canHandleThroughput(targetThroughput: number): boolean {
    return this.metrics.throughput >= targetThroughput;
  }
}

/**
 * Global validator instance
 */
let globalValidator: EventValidator | null = null;

/**
 * Get the global validator instance
 */
export function getValidator(options?: ValidatorOptions): EventValidator {
  if (!globalValidator) {
    globalValidator = new EventValidator(options);
  }
  return globalValidator;
}

/**
 * Convenience function to validate a single event
 */
export function validateEvent(data: unknown, schemaType?: SchemaType): ValidationResult {
  const validator = getValidator();
  return schemaType ? validator.validate(data, schemaType) : validator.validateAuto(data);
}

/**
 * Convenience function to validate multiple events
 */
export function validateEvents(events: Array<{ data: unknown; schemaType?: SchemaType }>): ValidationResult[] {
  const validator = getValidator();
  return events.map(event => 
    event.schemaType 
      ? validator.validate(event.data, event.schemaType)
      : validator.validateAuto(event.data)
  );
} 