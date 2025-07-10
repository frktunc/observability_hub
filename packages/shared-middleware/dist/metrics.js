"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lightweightMetrics = exports.defaultMetrics = void 0;
exports.metricsMiddleware = metricsMiddleware;
exports.getMetrics = getMetrics;
exports.resetMetrics = resetMetrics;
/**
 * Simple in-memory metrics store
 * In production, you'd want to use Prometheus, StatsD, or similar
 */
class SimpleMetricsStore {
    constructor() {
        this.requestCount = 0;
        this.requestsByMethod = {};
        this.requestsByPath = {};
        this.requestsByStatus = {};
        this.totalDuration = 0;
        this.minDuration = Infinity;
        this.maxDuration = 0;
    }
    recordRequest(data) {
        this.requestCount++;
        // Method metrics
        this.requestsByMethod[data.method] = (this.requestsByMethod[data.method] || 0) + 1;
        // Path metrics
        this.requestsByPath[data.path] = (this.requestsByPath[data.path] || 0) + 1;
        // Status code metrics
        this.requestsByStatus[data.statusCode] = (this.requestsByStatus[data.statusCode] || 0) + 1;
        // Duration metrics
        this.totalDuration += data.duration;
        this.minDuration = Math.min(this.minDuration, data.duration);
        this.maxDuration = Math.max(this.maxDuration, data.duration);
    }
    getMetrics() {
        return {
            requests: {
                total: this.requestCount,
                byMethod: this.requestsByMethod,
                byPath: this.requestsByPath,
                byStatus: this.requestsByStatus
            },
            timing: {
                total: this.totalDuration,
                average: this.requestCount > 0 ? this.totalDuration / this.requestCount : 0,
                min: this.minDuration === Infinity ? 0 : this.minDuration,
                max: this.maxDuration
            }
        };
    }
    reset() {
        this.requestCount = 0;
        this.requestsByMethod = {};
        this.requestsByPath = {};
        this.requestsByStatus = {};
        this.totalDuration = 0;
        this.minDuration = Infinity;
        this.maxDuration = 0;
    }
}
// Global metrics store instance
const globalMetricsStore = new SimpleMetricsStore();
/**
 * Unified metrics middleware for all microservices
 *
 * Features:
 * - Request counting
 * - Timing metrics
 * - Status code tracking
 * - Route-specific metrics
 * - Custom metrics collection
 * - Path filtering
 * - Console logging
 *
 * @param options Configuration options
 * @returns Express middleware function
 */
function metricsMiddleware(options = {}) {
    const { collectTiming = true, collectRequestCount = true, collectStatusCodes = true, collectRouteMetrics = true, customCollector, skipPaths = [], logToConsole = true } = options;
    return (req, res, next) => {
        // Skip metrics for certain paths
        if (skipPaths.includes(req.path)) {
            return next();
        }
        const startTime = Date.now();
        // Override res.end to collect metrics
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            const duration = Date.now() - startTime;
            const path = req.route?.path || req.path;
            const metricsData = {
                method: req.method,
                path,
                statusCode: res.statusCode,
                duration,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId,
                userAgent: req.get('User-Agent')
            };
            // Collect metrics to store
            if (collectRequestCount || collectTiming || collectStatusCodes || collectRouteMetrics) {
                globalMetricsStore.recordRequest(metricsData);
            }
            // Custom metrics collection
            if (customCollector) {
                customCollector(metricsData);
            }
            // Log to console if enabled
            if (logToConsole) {
                console.log(`[METRICS] ${metricsData.method} ${metricsData.path} - ${metricsData.statusCode} - ${duration}ms`);
            }
            return originalEnd.call(this, chunk, encoding);
        };
        next();
    };
}
/**
 * Get current metrics from the global store
 */
function getMetrics() {
    return globalMetricsStore.getMetrics();
}
/**
 * Reset all metrics
 */
function resetMetrics() {
    globalMetricsStore.reset();
}
/**
 * Default metrics middleware with standard configuration
 */
exports.defaultMetrics = metricsMiddleware();
/**
 * Lightweight metrics for high-traffic scenarios
 */
exports.lightweightMetrics = metricsMiddleware({
    collectTiming: true,
    collectRequestCount: true,
    collectStatusCodes: false,
    collectRouteMetrics: false,
    logToConsole: false,
    skipPaths: ['/health', '/metrics']
});
//# sourceMappingURL=metrics.js.map