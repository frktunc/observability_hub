import { Request, Response, NextFunction } from 'express';
export interface MetricsMiddlewareOptions {
    /**
     * Whether to collect route-specific metrics.
     * If false, 'route' label will be set to a generic value.
     * @default true
     */
    collectRouteMetrics?: boolean;
    /**
     * Paths to exclude from metrics collection.
     * @default ['/metrics', '/health']
     */
    skipPaths?: string[];
}
/**
 * Express middleware to collect Prometheus metrics for HTTP requests.
 *
 * This middleware tracks:
 * - Total number of requests (`http_requests_total`)
 * - Request latency (`http_request_duration_seconds`)
 *
 * Metrics are labeled by method, route, and status code for detailed analysis.
 *
 * @param options - Configuration options for the middleware.
 * @returns An Express middleware function.
 */
export declare function metricsMiddleware(options?: MetricsMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * A pre-configured default metrics middleware instance.
 * Skips `/metrics` and `/health` paths by default.
 */
export declare const defaultMetrics: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Function to get the underlying prom-client register.
 * Useful for custom metric registration.
 */
export declare function getPrometheusRegister(): import("prom-client").Registry<"text/plain; version=0.0.4; charset=utf-8">;
//# sourceMappingURL=metrics.d.ts.map