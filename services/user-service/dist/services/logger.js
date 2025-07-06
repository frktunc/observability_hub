"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownLogger = exports.initializeLogger = exports.createRequestLogger = exports.rawLogger = exports.structuredLogger = void 0;
/* eslint-disable no-console */
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const config_1 = require("@/config");
// Custom log levels with priorities
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'magenta',
};
// Custom format for development (pretty print)
const prettyFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ timestamp, level, message, service, correlationId, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    if (service) {
        logMessage += ` [${service}]`;
    }
    if (correlationId) {
        logMessage += ` [${correlationId}]`;
    }
    logMessage += `: ${message}`;
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return logMessage;
}));
// Custom format for production (JSON)
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
    // Ensure consistent structure
    const logEntry = {
        timestamp: info.timestamp,
        level: info.level,
        message: info.message,
        service: info.service || config_1.config.SERVICE_NAME,
        version: info.version || config_1.config.SERVICE_VERSION,
        environment: config_1.config.NODE_ENV,
        correlationId: info.correlationId,
        requestId: info.requestId,
        userId: info.userId,
        operation: info.operation,
        component: info.component,
        duration: info.duration,
        error: info.error,
        metadata: info.metadata,
        stack: info.stack,
    };
    // Remove undefined values
    Object.keys(logEntry).forEach(key => {
        if (logEntry[key] === undefined) {
            delete logEntry[key];
        }
    });
    return JSON.stringify(logEntry);
}));
// Create transports
const transports = [];
// Console transport
if (config_1.config.NODE_ENV === 'development') {
    transports.push(new winston_1.default.transports.Console({
        format: config_1.config.LOG_FORMAT === 'pretty' ? prettyFormat : jsonFormat,
        level: config_1.config.LOG_LEVEL,
    }));
}
else {
    transports.push(new winston_1.default.transports.Console({
        format: jsonFormat,
        level: config_1.config.LOG_LEVEL,
    }));
}
// File transport with rotation (production only)
if (config_1.config.NODE_ENV !== 'development') {
    // All logs
    transports.push(new winston_daily_rotate_file_1.default({
        filename: 'logs/application-%DATE%.log',
        datePattern: config_1.config.LOG_DATE_PATTERN,
        maxSize: config_1.config.LOG_MAX_FILE_SIZE,
        maxFiles: config_1.config.LOG_MAX_FILES,
        format: jsonFormat,
        level: config_1.config.LOG_LEVEL,
    }));
    // Error logs only
    transports.push(new winston_daily_rotate_file_1.default({
        filename: 'logs/error-%DATE%.log',
        datePattern: config_1.config.LOG_DATE_PATTERN,
        maxSize: config_1.config.LOG_MAX_FILE_SIZE,
        maxFiles: config_1.config.LOG_MAX_FILES,
        format: jsonFormat,
        level: 'error',
    }));
}
// Create logger instance
winston_1.default.addColors(logColors);
const logger = winston_1.default.createLogger({
    levels: logLevels,
    level: config_1.config.LOG_LEVEL,
    defaultMeta: {
        service: config_1.config.SERVICE_NAME,
        version: config_1.config.SERVICE_VERSION,
        instance: config_1.config.SERVICE_INSTANCE_ID,
    },
    transports,
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston_1.default.transports.Console({
            format: config_1.config.NODE_ENV === 'development' ? prettyFormat : jsonFormat,
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.Console({
            format: config_1.config.NODE_ENV === 'development' ? prettyFormat : jsonFormat,
        }),
    ],
    exitOnError: false, // Don't exit on handled exceptions
});
// Timer tracking for performance measurements
const timers = new Map();
// Create structured logger wrapper
class StructuredLoggerImpl {
    baseLogger;
    persistentContext;
    constructor(baseLogger, persistentContext = {}) {
        this.baseLogger = baseLogger;
        this.persistentContext = persistentContext;
    }
    mergeContext(context) {
        return { ...this.persistentContext, ...context };
    }
    trace(message, context) {
        this.baseLogger.log('trace', message, this.mergeContext(context));
    }
    debug(message, context) {
        this.baseLogger.debug(message, this.mergeContext(context));
    }
    info(message, context) {
        this.baseLogger.info(message, this.mergeContext(context));
    }
    warn(message, context) {
        this.baseLogger.warn(message, this.mergeContext(context));
    }
    error(message, context) {
        // Extract error details if Error object is passed
        const mergedContext = this.mergeContext(context);
        if (mergedContext.error instanceof Error) {
            if (mergedContext.error.stack) {
                mergedContext.stack = mergedContext.error.stack;
            }
            mergedContext.error = {
                name: mergedContext.error.name,
                message: mergedContext.error.message,
            };
        }
        this.baseLogger.error(message, mergedContext);
    }
    timeStart(operation, context) {
        const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        timers.set(timerId, {
            start: Date.now(),
            operation,
            context: this.mergeContext(context),
        });
        this.debug(`Starting operation: ${operation}`, {
            ...this.mergeContext(context),
            timerId,
        });
        return timerId;
    }
    timeEnd(timerId, message, context) {
        const timer = timers.get(timerId);
        if (!timer) {
            this.warn(`Timer not found: ${timerId}`);
            return;
        }
        const duration = Date.now() - timer.start;
        timers.delete(timerId);
        const logMessage = message || `Completed operation: ${timer.operation}`;
        const logContext = {
            ...timer.context,
            ...this.mergeContext(context),
            duration,
            operation: timer.operation,
        };
        // Log as warning if operation took too long
        if (duration > 5000) {
            this.warn(`${logMessage} (SLOW OPERATION)`, logContext);
        }
        else {
            this.info(logMessage, logContext);
        }
    }
    businessEvent(event, data, context) {
        this.info(`Business Event: ${event}`, {
            ...this.mergeContext(context),
            eventType: 'business',
            eventName: event,
            eventData: data,
        });
    }
    securityEvent(event, data, context) {
        this.warn(`Security Event: ${event}`, {
            ...this.mergeContext(context),
            eventType: 'security',
            eventName: event,
            eventData: data,
        });
    }
    child(persistentContext) {
        return new StructuredLoggerImpl(this.baseLogger, {
            ...this.persistentContext,
            ...persistentContext,
        });
    }
}
// Export the structured logger instance
exports.structuredLogger = new StructuredLoggerImpl(logger);
// Export the raw winston logger for special cases
exports.rawLogger = logger;
// Helper function to create request-scoped logger
const createRequestLogger = (correlationId, requestId) => {
    const context = { correlationId };
    if (requestId) {
        context.requestId = requestId;
    }
    return exports.structuredLogger.child(context);
};
exports.createRequestLogger = createRequestLogger;
// Logger startup
const initializeLogger = () => {
    exports.structuredLogger.info('Logger initialized', {
        level: config_1.config.LOG_LEVEL,
        format: config_1.config.LOG_FORMAT,
        environment: config_1.config.NODE_ENV,
        transports: transports.length,
    });
    // Test all log levels in development
    if (config_1.config.NODE_ENV === 'development') {
        exports.structuredLogger.trace('Logger test: TRACE level');
        exports.structuredLogger.debug('Logger test: DEBUG level');
        exports.structuredLogger.info('Logger test: INFO level');
        exports.structuredLogger.warn('Logger test: WARN level');
        exports.structuredLogger.error('Logger test: ERROR level');
    }
};
exports.initializeLogger = initializeLogger;
// Graceful shutdown
const shutdownLogger = () => {
    return new Promise((resolve) => {
        logger.end(() => {
            console.log('Logger shutdown completed');
            resolve();
        });
    });
};
exports.shutdownLogger = shutdownLogger;
//# sourceMappingURL=logger.js.map