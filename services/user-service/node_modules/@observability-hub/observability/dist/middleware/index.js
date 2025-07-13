"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrometheusRegister = exports.metricsMiddleware = exports.defaultMetrics = exports.requestLoggingMiddleware = exports.minimalRequestLogging = exports.defaultRequestLogging = exports.errorHandlerMiddleware = exports.defaultErrorHandler = exports.correlationIdMiddleware = exports.defaultCorrelationIdMiddleware = void 0;
// Export all middleware
__exportStar(require("./correlation-id"), exports);
__exportStar(require("./error-handler"), exports);
__exportStar(require("./request-logging"), exports);
__exportStar(require("./metrics"), exports);
// Export commonly used defaults for convenience
var correlation_id_1 = require("./correlation-id");
Object.defineProperty(exports, "defaultCorrelationIdMiddleware", { enumerable: true, get: function () { return correlation_id_1.defaultCorrelationIdMiddleware; } });
Object.defineProperty(exports, "correlationIdMiddleware", { enumerable: true, get: function () { return correlation_id_1.correlationIdMiddleware; } });
var error_handler_1 = require("./error-handler");
Object.defineProperty(exports, "defaultErrorHandler", { enumerable: true, get: function () { return error_handler_1.defaultErrorHandler; } });
Object.defineProperty(exports, "errorHandlerMiddleware", { enumerable: true, get: function () { return error_handler_1.errorHandlerMiddleware; } });
var request_logging_1 = require("./request-logging");
Object.defineProperty(exports, "defaultRequestLogging", { enumerable: true, get: function () { return request_logging_1.defaultRequestLogging; } });
Object.defineProperty(exports, "minimalRequestLogging", { enumerable: true, get: function () { return request_logging_1.minimalRequestLogging; } });
Object.defineProperty(exports, "requestLoggingMiddleware", { enumerable: true, get: function () { return request_logging_1.requestLoggingMiddleware; } });
var metrics_1 = require("./metrics");
Object.defineProperty(exports, "defaultMetrics", { enumerable: true, get: function () { return metrics_1.defaultMetrics; } });
Object.defineProperty(exports, "metricsMiddleware", { enumerable: true, get: function () { return metrics_1.metricsMiddleware; } });
Object.defineProperty(exports, "getPrometheusRegister", { enumerable: true, get: function () { return metrics_1.getPrometheusRegister; } });
/**
 * @observability-hub/shared-middleware
 *
 * A collection of reusable Express middleware for Observability Hub microservices.
 *
 * This package provides:
 * - Correlation ID tracking
 * - Unified error handling
 * - Request/response logging
 * - Basic metrics collection
 *
 * All middleware are configurable and provide sensible defaults.
 *
 * @example
 * ```typescript
 * import {
 *   defaultCorrelationIdMiddleware,
 *   defaultErrorHandler,
 *   defaultRequestLogging,
 *   defaultMetrics
 * } from '@observability-hub/shared-middleware';
 *
 * const app = express();
 *
 * // Apply common middleware
 * app.use(defaultCorrelationIdMiddleware);
 * app.use(defaultRequestLogging);
 * app.use(defaultMetrics);
 *
 * // ... your routes ...
 *
 * // Error handling (must be last)
 * app.use(defaultErrorHandler);
 * ```
 */
//# sourceMappingURL=index.js.map