import { Request, Response, NextFunction } from 'express';
export interface MetricsOptions {
    /**
     * Whether to collect timing metrics
     * @default true
     */
    collectTiming?: boolean;
    /**
     * Whether to collect request count metrics
     * @default true
     */
    collectRequestCount?: boolean;
    /**
     * Whether to collect status code metrics
     * @default true
     */
    collectStatusCodes?: boolean;
    /**
     * Whether to collect route-specific metrics
     * @default true
     */
    collectRouteMetrics?: boolean;
    /**
     * Custom metrics collector function
     */
    customCollector?: (metrics: MetricsData) => void;
    /**
     * Skip metrics collection for certain paths
     */
    skipPaths?: string[];
    /**
     * Whether to log basic metrics to console
     * @default true
     */
    logToConsole?: boolean;
}
export interface MetricsData {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    timestamp: string;
    correlationId?: string;
    userAgent?: string;
}
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
export declare function metricsMiddleware(options?: MetricsOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Get current metrics from the global store
 */
export declare function getMetrics(): {
    requests: {
        total: number;
        byMethod: Record<string, number>;
        byPath: Record<string, number>;
        byStatus: Record<number, number>;
    };
    timing: {
        total: number;
        average: number;
        min: number;
        max: number;
    };
};
/**
 * Reset all metrics
 */
export declare function resetMetrics(): void;
/**
 * Default metrics middleware with standard configuration
 */
export declare const defaultMetrics: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Lightweight metrics for high-traffic scenarios
 */
export declare const lightweightMetrics: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=metrics.d.ts.map