"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCorrelationIdMiddleware = void 0;
exports.correlationIdMiddleware = correlationIdMiddleware;
const uuid_1 = require("uuid");
/**
 * Middleware to handle correlation IDs for request tracing
 *
 * This middleware:
 * - Extracts correlation ID from request headers
 * - Generates a new one if missing (optional)
 * - Adds correlation ID to request object
 * - Includes correlation ID in response headers (optional)
 *
 * @param options Configuration options
 * @returns Express middleware function
 */
function correlationIdMiddleware(options = {}) {
    const { headerName = 'x-correlation-id', generateIfMissing = true, includeInResponse = true, generator = uuid_1.v4 } = options;
    return (req, res, next) => {
        // Get correlation ID from headers
        let correlationId = req.headers[headerName];
        // Generate new correlation ID if missing and generation is enabled
        if (!correlationId && generateIfMissing) {
            correlationId = generator();
        }
        // Add to request object for downstream use
        if (correlationId) {
            req.correlationId = correlationId;
            // Add to response headers if enabled
            if (includeInResponse) {
                res.setHeader(headerName, correlationId);
            }
        }
        next();
    };
}
/**
 * Default correlation ID middleware with standard configuration
 * Use this for most common use cases
 */
exports.defaultCorrelationIdMiddleware = correlationIdMiddleware();
//# sourceMappingURL=correlation-id.js.map