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
 * Simple in-memory metrics store
 * In production, you'd want to use Prometheus, StatsD, or similar
 */
class SimpleMetricsStore {
  private requestCount = 0;
  private requestsByMethod: Record<string, number> = {};
  private requestsByPath: Record<string, number> = {};
  private requestsByStatus: Record<number, number> = {};
  private totalDuration = 0;
  private minDuration = Infinity;
  private maxDuration = 0;

  public recordRequest(data: MetricsData): void {
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

  public getMetrics() {
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

  public reset(): void {
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
export function metricsMiddleware(options: MetricsOptions = {}) {
  const {
    collectTiming = true,
    collectRequestCount = true,
    collectStatusCodes = true,
    collectRouteMetrics = true,
    customCollector,
    skipPaths = [],
    logToConsole = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip metrics for certain paths
    if (skipPaths.includes(req.path)) {
      return next();
    }

    const startTime = Date.now();

    // Override res.end to collect metrics
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any): any {
      const duration = Date.now() - startTime;
      const path = req.route?.path || req.path;
      
      const metricsData: MetricsData = {
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
export function getMetrics() {
  return globalMetricsStore.getMetrics();
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  globalMetricsStore.reset();
}

/**
 * Default metrics middleware with standard configuration
 */
export const defaultMetrics = metricsMiddleware();

/**
 * Lightweight metrics for high-traffic scenarios
 */
export const lightweightMetrics = metricsMiddleware({
  collectTiming: true,
  collectRequestCount: true,
  collectStatusCodes: false,
  collectRouteMetrics: false,
  logToConsole: false,
  skipPaths: ['/health', '/metrics']
}); 