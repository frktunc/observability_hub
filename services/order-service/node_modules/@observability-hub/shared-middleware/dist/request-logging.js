"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimalRequestLogging = exports.defaultRequestLogging = void 0;
exports.requestLoggingMiddleware = requestLoggingMiddleware;
/**
 * Default field configuration
 */
const defaultIncludeFields = {
    method: true,
    url: true,
    userAgent: true,
    ip: true,
    correlationId: true,
    statusCode: true,
    duration: true,
    contentLength: false
};
/**
 * Default status code log levels
 */
const defaultStatusCodeLogLevels = {
    400: 'warn',
    401: 'warn',
    403: 'warn',
    404: 'info',
    429: 'warn',
    500: 'error',
    502: 'error',
    503: 'error',
    504: 'error'
};
/**
 * Unified request logging middleware for all microservices
 *
 * Features:
 * - Configurable request/response logging
 * - Correlation ID tracking
 * - Performance monitoring (duration)
 * - Flexible field inclusion
 * - Custom logger support
 * - Path/method filtering
 * - Status code-based log levels
 *
 * @param options Configuration options
 * @returns Express middleware function
 */
function requestLoggingMiddleware(options = {}) {
    const { logRequestStart = true, logRequestEnd = true, includeFields = {}, customLogger, skipPaths = [], skipMethods = [], statusCodeLogLevels = {} } = options;
    const fields = { ...defaultIncludeFields, ...includeFields };
    const statusLevels = { ...defaultStatusCodeLogLevels, ...statusCodeLogLevels };
    const defaultLogger = (level, message, metadata) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
    };
    const logger = customLogger || defaultLogger;
    return (req, res, next) => {
        // Skip logging for certain paths or methods
        if (skipPaths.includes(req.path) || skipMethods.includes(req.method)) {
            return next();
        }
        // Record start time
        req.startTime = Date.now();
        // Build request metadata
        const requestMetadata = {};
        if (fields.method)
            requestMetadata.method = req.method;
        if (fields.url)
            requestMetadata.url = req.url;
        if (fields.userAgent)
            requestMetadata.userAgent = req.get('User-Agent');
        if (fields.ip)
            requestMetadata.ip = req.ip;
        if (fields.correlationId)
            requestMetadata.correlationId = req.correlationId || 'unknown';
        // Log request start
        if (logRequestStart) {
            logger('info', 'Incoming request', requestMetadata);
        }
        // Override res.end to log response
        if (logRequestEnd) {
            const originalEnd = res.end;
            res.end = function (chunk, encoding) {
                const duration = Date.now() - (req.startTime || 0);
                // Build response metadata
                const responseMetadata = { ...requestMetadata };
                if (fields.statusCode)
                    responseMetadata.statusCode = res.statusCode;
                if (fields.duration)
                    responseMetadata.duration = `${duration}ms`;
                if (fields.contentLength) {
                    const contentLength = res.get('Content-Length');
                    if (contentLength)
                        responseMetadata.contentLength = contentLength;
                }
                // Determine log level based on status code
                const statusCode = res.statusCode;
                const logLevel = statusLevels[statusCode] ||
                    (statusCode >= 500 ? 'error' :
                        statusCode >= 400 ? 'warn' : 'info');
                logger(logLevel, 'Request completed', responseMetadata);
                return originalEnd.call(this, chunk, encoding);
            };
        }
        next();
    };
}
/**
 * Default request logging middleware with standard configuration
 * Use this for most common use cases
 */
exports.defaultRequestLogging = requestLoggingMiddleware();
/**
 * Minimal request logging for high-traffic endpoints
 */
exports.minimalRequestLogging = requestLoggingMiddleware({
    logRequestStart: false,
    includeFields: {
        method: true,
        url: true,
        correlationId: true,
        statusCode: true,
        duration: true,
        userAgent: false,
        ip: false,
        contentLength: false
    },
    skipPaths: ['/health', '/metrics']
});
//# sourceMappingURL=request-logging.js.map