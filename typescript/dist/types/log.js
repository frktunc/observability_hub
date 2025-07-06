"use strict";
/**
 * Log event types for structured logging
 * Generated from JSON Schema contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVEL_HIERARCHY = void 0;
exports.isLogEvent = isLogEvent;
exports.isErrorLogEvent = isErrorLogEvent;
exports.createLogEvent = createLogEvent;
exports.isLogLevelEnabled = isLogLevelEnabled;
exports.sanitizeLogData = sanitizeLogData;
/**
 * Type guard to check if an event is a log event
 */
function isLogEvent(event) {
    return /^log\.(message|error|warning|info|debug)\.(created|updated)$/.test(event.eventType);
}
/**
 * Type guard to check if a log event is an error event
 */
function isErrorLogEvent(event) {
    return event.eventType.includes('error') || event.data.level === 'ERROR' || event.data.level === 'FATAL';
}
/**
 * Helper to create a log event with required fields
 */
function createLogEvent(data, baseFields) {
    let eventType;
    // Determine event type based on log level
    switch (data.level) {
        case 'ERROR':
        case 'FATAL':
            eventType = 'log.error.created';
            break;
        case 'WARN':
            eventType = 'log.warning.created';
            break;
        case 'INFO':
            eventType = 'log.info.created';
            break;
        case 'DEBUG':
        case 'TRACE':
            eventType = 'log.debug.created';
            break;
        default:
            eventType = 'log.message.created';
    }
    return {
        ...baseFields,
        eventType,
        data,
    };
}
/**
 * Log level hierarchy for filtering and comparison
 */
exports.LOG_LEVEL_HIERARCHY = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5,
};
/**
 * Check if a log level meets the minimum threshold
 */
function isLogLevelEnabled(level, minLevel) {
    return exports.LOG_LEVEL_HIERARCHY[level] >= exports.LOG_LEVEL_HIERARCHY[minLevel];
}
/**
 * Sanitize sensitive data from log message and structured fields
 */
function sanitizeLogData(data) {
    const sensitivePatterns = [
        /password/i,
        /token/i,
        /key/i,
        /secret/i,
        /authorization/i,
        /credential/i,
    ];
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            return sensitivePatterns.some(pattern => pattern.test(value)) ? '[REDACTED]' : value;
        }
        if (typeof value === 'object' && value !== null) {
            const obj = value;
            const sanitized = {};
            for (const [key, val] of Object.entries(obj)) {
                if (sensitivePatterns.some(pattern => pattern.test(key))) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = sanitizeValue(val);
                }
            }
            return sanitized;
        }
        return value;
    };
    const sanitizedData = {
        ...data,
    };
    if (data.structured) {
        sanitizedData.structured = {
            ...data.structured,
        };
        if (data.structured.fields) {
            sanitizedData.structured.fields = sanitizeValue(data.structured.fields);
        }
    }
    if (data.context) {
        sanitizedData.context = sanitizeValue(data.context);
    }
    return sanitizedData;
}
//# sourceMappingURL=log.js.map