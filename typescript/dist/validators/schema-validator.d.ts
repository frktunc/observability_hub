/**
 * High-performance JSON Schema validator for observability events
 * Uses simplified validation for browser/TypeScript compatibility
 */
import { ValidationResult } from '../types/base';
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
export declare class EventValidator {
    private validators;
    private metrics;
    private cacheHits;
    private cacheMisses;
    constructor(_options?: ValidatorOptions);
    /**
     * Initialize mock validators for each schema type
     */
    private initializeValidators;
    /**
     * Validate data against a specific schema
     */
    validate(data: unknown, schemaType: SchemaType): ValidationResult;
    /**
     * Validate multiple events in batch
     */
    validateBatch(events: Array<{
        data: unknown;
        schemaType: SchemaType;
    }>): ValidationResult[];
    /**
     * Auto-detect schema type and validate
     */
    validateAuto(data: unknown): ValidationResult;
    /**
     * Detect schema type from event data
     */
    private detectSchemaType;
    /**
     * Format AJV errors to our error format
     */
    private formatErrors;
    /**
     * Get current time for performance measurements
     */
    private getCurrentTime;
    /**
     * Update performance metrics
     */
    private updateMetrics;
    /**
     * Get current performance metrics
     */
    getMetrics(): ValidationMetrics;
    /**
     * Reset performance metrics
     */
    resetMetrics(): void;
    /**
     * Get list of supported schema types
     */
    getSupportedSchemas(): SchemaType[];
    /**
     * Check if validator can handle the given throughput
     */
    canHandleThroughput(targetThroughput: number): boolean;
}
/**
 * Get the global validator instance
 */
export declare function getValidator(options?: ValidatorOptions): EventValidator;
/**
 * Convenience function to validate a single event
 */
export declare function validateEvent(data: unknown, schemaType?: SchemaType): ValidationResult;
/**
 * Convenience function to validate multiple events
 */
export declare function validateEvents(events: Array<{
    data: unknown;
    schemaType?: SchemaType;
}>): ValidationResult[];
//# sourceMappingURL=schema-validator.d.ts.map