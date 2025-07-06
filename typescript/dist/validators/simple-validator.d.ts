/**
 * Simplified event validator for observability events
 * Provides basic validation without external dependencies
 */
import { ValidationResult } from '../types/base';
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
export declare class SimpleEventValidator {
    private metrics;
    private successfulValidations;
    /**
     * Validate any event structure
     */
    validate(data: unknown): ValidationResult;
    /**
     * Validate multiple events in batch
     */
    validateBatch(events: unknown[]): ValidationResult[];
    /**
     * Check if value is a valid object
     */
    private isValidObject;
    /**
     * Validate base event structure
     */
    private validateBaseEvent;
    /**
     * Validate source object
     */
    private validateSource;
    /**
     * Validate metadata object
     */
    private validateMetadata;
    /**
     * Validate tracing context
     */
    private validateTracing;
    /**
     * Validate event type specific rules
     */
    private validateEventType;
    /**
     * Validate log event data
     */
    private validateLogEventData;
    /**
     * Validate metrics event data
     */
    private validateMetricsEventData;
    /**
     * Validate trace event data
     */
    private validateTraceEventData;
    /**
     * Create validation result with metrics update
     */
    private createResult;
    /**
     * Get current validation metrics
     */
    getMetrics(): ValidationMetrics;
    /**
     * Reset validation metrics
     */
    resetMetrics(): void;
    /**
     * Check if validator can handle target throughput
     */
    canHandleThroughput(targetThroughput: number): boolean;
}
/**
 * Get the global validator instance
 */
export declare function getSimpleValidator(): SimpleEventValidator;
/**
 * Convenience function to validate a single event
 */
export declare function validateEvent(data: unknown): ValidationResult;
/**
 * Convenience function to validate multiple events
 */
export declare function validateEvents(events: unknown[]): ValidationResult[];
export {};
//# sourceMappingURL=simple-validator.d.ts.map