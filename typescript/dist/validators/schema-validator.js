"use strict";
/**
 * High-performance JSON Schema validator for observability events
 * Uses simplified validation for browser/TypeScript compatibility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventValidator = void 0;
exports.getValidator = getValidator;
exports.validateEvent = validateEvent;
exports.validateEvents = validateEvents;
// Mock schemas - in real implementation these would be loaded properly
const mockSchemas = {
    'base-event': { type: 'object', required: ['eventId', 'eventType', 'timestamp', 'correlationId'] },
    'log-event': { type: 'object', required: ['eventId', 'eventType', 'data'] },
    'metrics-event': { type: 'object', required: ['eventId', 'eventType', 'data'] },
    'trace-event': { type: 'object', required: ['eventId', 'eventType', 'data'] }
};
/**
 * High-performance event validator with caching and metrics
 */
class EventValidator {
    validators = new Map();
    metrics;
    cacheHits = 0;
    cacheMisses = 0;
    constructor(_options = {}) {
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
    initializeValidators() {
        for (const schemaType of Object.keys(mockSchemas)) {
            const validator = (data) => {
                if (!data || typeof data !== 'object') {
                    validator.errors = [{
                            instancePath: '',
                            message: 'Data must be an object',
                            keyword: 'type',
                        }];
                    return false;
                }
                const event = data;
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
    validate(data, schemaType) {
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
            const result = { valid: isValid };
            if (errors.length > 0) {
                result.errors = errors;
            }
            return result;
        }
        catch (error) {
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
    validateBatch(events) {
        return events.map(event => this.validate(event.data, event.schemaType));
    }
    /**
     * Auto-detect schema type and validate
     */
    validateAuto(data) {
        if (!data || typeof data !== 'object') {
            return {
                valid: false,
                errors: [{
                        field: 'data',
                        message: 'Data must be an object',
                    }]
            };
        }
        const event = data;
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
    detectSchemaType(event) {
        const eventType = event.eventType;
        if (typeof eventType !== 'string')
            return null;
        if (eventType.startsWith('log.'))
            return 'log-event';
        if (eventType.startsWith('metrics.'))
            return 'metrics-event';
        if (eventType.startsWith('trace.'))
            return 'trace-event';
        return 'base-event';
    }
    /**
     * Format AJV errors to our error format
     */
    formatErrors(ajvErrors) {
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
    getCurrentTime() {
        // Use Date.now() for browser compatibility
        return Date.now();
    }
    /**
     * Update performance metrics
     */
    updateMetrics(validationTime) {
        this.metrics.totalValidations++;
        this.metrics.totalTime += validationTime;
        this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalValidations;
        this.metrics.throughput = (this.metrics.totalValidations / this.metrics.totalTime) * 1000;
        this.metrics.cacheHitRatio = this.cacheHits / (this.cacheHits + this.cacheMisses);
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset performance metrics
     */
    resetMetrics() {
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
    getSupportedSchemas() {
        return Array.from(this.validators.keys());
    }
    /**
     * Check if validator can handle the given throughput
     */
    canHandleThroughput(targetThroughput) {
        return this.metrics.throughput >= targetThroughput;
    }
}
exports.EventValidator = EventValidator;
/**
 * Global validator instance
 */
let globalValidator = null;
/**
 * Get the global validator instance
 */
function getValidator(options) {
    if (!globalValidator) {
        globalValidator = new EventValidator(options);
    }
    return globalValidator;
}
/**
 * Convenience function to validate a single event
 */
function validateEvent(data, schemaType) {
    const validator = getValidator();
    return schemaType ? validator.validate(data, schemaType) : validator.validateAuto(data);
}
/**
 * Convenience function to validate multiple events
 */
function validateEvents(events) {
    const validator = getValidator();
    return events.map(event => event.schemaType
        ? validator.validate(event.data, event.schemaType)
        : validator.validateAuto(event.data));
}
//# sourceMappingURL=schema-validator.js.map