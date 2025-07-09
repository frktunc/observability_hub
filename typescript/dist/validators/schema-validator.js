"use strict";
/**
 * High-performance JSON Schema validator for observability events
 * Uses AJV (Another JSON Schema Validator) for full JSON Schema support
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventValidator = void 0;
exports.getValidator = getValidator;
exports.validateEvent = validateEvent;
exports.validateEvents = validateEvents;
exports.resetGlobalValidator = resetGlobalValidator;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * High-performance event validator with caching and metrics
 */
class EventValidator {
    ajv;
    validators = new Map();
    schemas = new Map();
    metrics;
    cacheHits = 0;
    cacheMisses = 0;
    constructor(options = {}) {
        // Initialize AJV with options
        this.ajv = new ajv_1.default({
            strict: options.strict !== false,
            allErrors: options.allErrors === true,
            verbose: options.verbose === true,
            removeAdditional: false,
            useDefaults: true,
            coerceTypes: false,
        });
        // Add format validators if enabled
        if (options.enableFormats !== false) {
            (0, ajv_formats_1.default)(this.ajv);
        }
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
     * Load and compile JSON Schema validators
     */
    initializeValidators() {
        const schemaFiles = {
            'base-event': '../../../contracts/schemas/base-event.schema.json',
            'log-event': '../../../contracts/schemas/log-event.schema.json',
            'metrics-event': '../../../contracts/schemas/metrics-event.schema.json',
            'trace-event': '../../../contracts/schemas/trace-event.schema.json',
        };
        try {
            // Load schemas
            for (const [schemaType, filePath] of Object.entries(schemaFiles)) {
                const schemaPath = path.resolve(__dirname, filePath);
                if (fs.existsSync(schemaPath)) {
                    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
                    const schema = JSON.parse(schemaContent);
                    this.schemas.set(schemaType, schema);
                }
                else {
                    // Fallback to mock schema if file not found
                    console.warn(`Schema file not found: ${schemaPath}, using fallback schema`);
                    this.schemas.set(schemaType, this.getFallbackSchema(schemaType));
                }
            }
            // Add base schema as reference for other schemas
            const baseSchema = this.schemas.get('base-event');
            if (baseSchema) {
                this.ajv.addSchema(baseSchema, 'base-event.schema.json');
            }
            // Compile validators
            for (const [schemaType, schema] of this.schemas.entries()) {
                try {
                    const validator = this.ajv.compile(schema);
                    this.validators.set(schemaType, validator);
                }
                catch (error) {
                    console.error(`Failed to compile schema for ${schemaType}:`, error);
                    // Use fallback validator
                    this.validators.set(schemaType, this.getFallbackValidator(schemaType));
                }
            }
        }
        catch (error) {
            console.error('Failed to initialize validators:', error);
            // Initialize with fallback validators
            this.initializeFallbackValidators();
        }
    }
    /**
     * Get fallback schema for when files are not found
     */
    getFallbackSchema(schemaType) {
        const baseSchema = {
            type: 'object',
            required: ['eventId', 'eventType', 'version', 'timestamp', 'correlationId', 'source', 'metadata'],
            properties: {
                eventId: { type: 'string', format: 'uuid' },
                eventType: { type: 'string' },
                version: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                correlationId: { type: 'string', format: 'uuid' },
                source: { type: 'object' },
                metadata: { type: 'object' },
            },
        };
        switch (schemaType) {
            case 'log-event':
                return {
                    ...baseSchema,
                    properties: {
                        ...baseSchema.properties,
                        data: {
                            type: 'object',
                            required: ['level', 'message', 'timestamp'],
                            properties: {
                                level: { type: 'string', enum: ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] },
                                message: { type: 'string' },
                                timestamp: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                };
            case 'metrics-event':
                return {
                    ...baseSchema,
                    properties: {
                        ...baseSchema.properties,
                        data: {
                            type: 'object',
                            required: ['name', 'type', 'value', 'unit', 'timestamp'],
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string', enum: ['counter', 'gauge', 'histogram', 'summary', 'timer'] },
                                value: { type: 'number' },
                                unit: { type: 'string' },
                                timestamp: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                };
            case 'trace-event':
                return {
                    ...baseSchema,
                    properties: {
                        ...baseSchema.properties,
                        data: {
                            type: 'object',
                            required: ['traceId', 'spanId', 'operationName', 'startTime'],
                            properties: {
                                traceId: { type: 'string' },
                                spanId: { type: 'string' },
                                operationName: { type: 'string' },
                                startTime: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                };
            default:
                return baseSchema;
        }
    }
    /**
     * Get fallback validator for when schema compilation fails
     */
    getFallbackValidator(_schemaType) {
        const validatorFunc = (data) => {
            if (!data || typeof data !== 'object') {
                return false;
            }
            const event = data;
            // Basic validation
            const required = ['eventId', 'eventType', 'timestamp', 'correlationId'];
            for (const field of required) {
                if (!(field in event) || event[field] === undefined || event[field] === null) {
                    return false;
                }
            }
            return true;
        };
        // Cast to ValidateFunction to satisfy AJV's interface requirements
        return validatorFunc;
    }
    /**
     * Initialize fallback validators when schema loading fails
     */
    initializeFallbackValidators() {
        const schemaTypes = ['base-event', 'log-event', 'metrics-event', 'trace-event'];
        for (const schemaType of schemaTypes) {
            this.validators.set(schemaType, this.getFallbackValidator(schemaType));
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
    /**
     * Get compiled schema for a given type
     */
    getSchema(schemaType) {
        return this.schemas.get(schemaType);
    }
    /**
     * Add a custom schema
     */
    addCustomSchema(schemaType, schema) {
        try {
            const validator = this.ajv.compile(schema);
            this.validators.set(schemaType, validator);
            this.schemas.set(schemaType, schema);
            return true;
        }
        catch (error) {
            console.error(`Failed to compile custom schema for ${schemaType}:`, error);
            return false;
        }
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
/**
 * Reset the global validator (useful for testing)
 */
function resetGlobalValidator() {
    globalValidator = null;
}
//# sourceMappingURL=schema-validator.js.map