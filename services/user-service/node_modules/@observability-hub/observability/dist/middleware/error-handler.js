"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultErrorHandler = void 0;
exports.errorHandlerMiddleware = errorHandlerMiddleware;
/**
 * Standard error status code mapping
 */
const defaultStatusCodeMapping = {
    'ValidationError': 400,
    'CastError': 400,
    'NotFoundError': 404,
    'UnauthorizedError': 401,
    'ForbiddenError': 403,
    'ConflictError': 409,
    'TooManyRequestsError': 429,
    'TimeoutError': 408,
    'PayloadTooLargeError': 413,
    'UnsupportedMediaTypeError': 415,
    'UnprocessableEntityError': 422,
    'InternalServerError': 500,
    'NotImplementedError': 501,
    'BadGatewayError': 502,
    'ServiceUnavailableError': 503,
    'GatewayTimeoutError': 504
};
/**
 * Unified error handler middleware for all microservices
 *
 * Features:
 * - Consistent error response format
 * - Correlation ID tracking
 * - Configurable error mapping
 * - Environment-aware error details
 * - Custom logging support
 *
 * @param options Configuration options
 * @returns Express error handler middleware
 */
function errorHandlerMiddleware(options = {}) {
    const { includeStackTrace = process.env.NODE_ENV === 'development', logErrors = true, customLogger, statusCodeMapping = {}, includeDetails = process.env.NODE_ENV !== 'production' } = options;
    const combinedStatusMapping = { ...defaultStatusCodeMapping, ...statusCodeMapping };
    return (error, req, res, _next) => {
        // Get correlation ID from request
        const correlationId = req.correlationId || 'unknown';
        // Log error if enabled
        if (logErrors) {
            if (customLogger) {
                customLogger(error, req);
            }
            else {
                console.error(`[${correlationId}] Error in ${req.method} ${req.path}:`, {
                    name: error.name,
                    message: error.message,
                    stack: includeStackTrace ? error.stack : undefined,
                    correlationId,
                    timestamp: new Date().toISOString()
                });
            }
        }
        // Determine status code
        const statusCode = combinedStatusMapping[error.name] || 500;
        // Build error response
        const errorResponse = {
            error: {
                message: error.message || 'Internal Server Error',
                type: error.name || 'Error',
                correlationId,
                timestamp: new Date().toISOString()
            }
        };
        // Add details in development/debug mode
        if (includeDetails) {
            errorResponse.error.details = {
                stack: includeStackTrace ? error.stack : undefined,
                path: req.path,
                method: req.method,
                statusCode
            };
        }
        // Send error response
        res.status(statusCode).json(errorResponse);
    };
}
/**
 * Default error handler with standard configuration
 * Use this for most common use cases
 */
exports.defaultErrorHandler = errorHandlerMiddleware();
//# sourceMappingURL=error-handler.js.map