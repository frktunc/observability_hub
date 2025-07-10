export * from './correlation-id';
export * from './error-handler';
export * from './request-logging';
export * from './metrics';
export { defaultCorrelationIdMiddleware, correlationIdMiddleware } from './correlation-id';
export { defaultErrorHandler, errorHandlerMiddleware } from './error-handler';
export { defaultRequestLogging, minimalRequestLogging, requestLoggingMiddleware } from './request-logging';
export { defaultMetrics, lightweightMetrics, metricsMiddleware, getMetrics, resetMetrics } from './metrics';
export type { CorrelationIdOptions } from './correlation-id';
export type { ErrorHandlerOptions, ErrorResponse } from './error-handler';
export type { RequestLoggingOptions } from './request-logging';
export type { MetricsOptions, MetricsData } from './metrics';
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
//# sourceMappingURL=index.d.ts.map