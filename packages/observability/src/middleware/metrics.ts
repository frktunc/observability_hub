import { Request, Response, NextFunction } from 'express';
import { Histogram, Counter, register, collectDefaultMetrics } from 'prom-client';

// Enable default metrics collection
collectDefaultMetrics();

// --- Prometheus Metrics Definitions ---

/**
 * Histogram for tracking HTTP request duration in seconds.
 * Labels:
 * - method: HTTP request method (e.g., GET, POST)
 * - route: The matched route path (e.g., /api/users/:id)
 * - status_code: HTTP status code of the response
 */
const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5], // Buckets in seconds
});

/**
 * Counter for tracking the total number of HTTP requests.
 * Labels:
 * - method: HTTP request method
 * - route: The matched route path
 * - status_code: HTTP status code
 */
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// --- Middleware ---

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
export function metricsMiddleware(options: MetricsMiddlewareOptions = {}) {
  const {
    collectRouteMetrics = true,
    skipPaths = ['/metrics', '/health'],
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip metrics for specified paths
    if (skipPaths.includes(req.path)) {
      return next();
    }

    // Start timer to measure request duration
    const end = httpRequestDurationSeconds.startTimer();

    // Capture response finish event to record metrics
    res.on('finish', () => {
      const route = collectRouteMetrics && req.route ? req.route.path : req.path;
      const statusCode = res.statusCode;

      // Increment request counter
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status_code: statusCode,
      });

      // End timer and record duration
      end({
        method: req.method,
        route,
        status_code: statusCode,
      });
    });

    next();
  };
}

// --- Exports ---

/**
 * A pre-configured default metrics middleware instance.
 * Skips `/metrics` and `/health` paths by default.
 */
export const defaultMetrics = metricsMiddleware();

/**
 * Function to get the underlying prom-client register.
 * Useful for custom metric registration.
 */
export function getPrometheusRegister() {
  return register;
}
