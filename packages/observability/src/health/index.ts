/// <reference types="node" />

export interface DependencyHealth {
  status: 'connected' | 'disconnected' | 'error' | 'degraded';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  version?: string;
  environment?: string;
  dependencies: {
    database: DependencyHealth;
    redis?: DependencyHealth;
    rateLimiting?: DependencyHealth;
    circuitBreaker?: DependencyHealth;
    [key: string]: DependencyHealth | undefined;
  };
  error?: string;
}

export interface DatabaseService {
  getConnectionStatus(): boolean;
}

export interface RedisService {
  isClientConnected(): boolean;
  healthCheck(): Promise<DependencyHealth>;
}

export interface RateLimitService {
  healthCheck(): Promise<DependencyHealth>;
}

export const createHealthCheckHandler = (
  serviceName: string,
  serviceVersion: string,
  dependencies: {
    database: DatabaseService;
    redis?: RedisService;
    rateLimiting?: RateLimitService;
  }
) => {
  return async (): Promise<HealthCheckResult> => {
    try {
      // Check database health
      const dbStatus = dependencies.database.getConnectionStatus();
      const databaseHealth: DependencyHealth = {
        status: dbStatus ? 'connected' : 'disconnected',
      };

      // Check Redis health (if available)
      let redisHealth: DependencyHealth | undefined;
      if (dependencies.redis) {
        try {
          redisHealth = await dependencies.redis.healthCheck();
        } catch (error) {
          redisHealth = { 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Redis health check failed' 
          };
        }
      }

      // Check rate limiting health (if available)
      let rateLimitHealth: DependencyHealth | undefined;
      if (dependencies.rateLimiting) {
        try {
          rateLimitHealth = await dependencies.rateLimiting.healthCheck();
        } catch (error) {
          rateLimitHealth = { 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Rate limiting health check failed' 
          };
        }
      }

      // Determine overall status
      const allDependencies = [
        databaseHealth,
        redisHealth,
        rateLimitHealth,
      ].filter(Boolean) as DependencyHealth[];

      const hasError = allDependencies.some(dep => dep.status === 'error');
      const hasDisconnected = allDependencies.some(dep => dep.status === 'disconnected');
      const hasDegraded = allDependencies.some(dep => dep.status === 'degraded');

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (hasError) {
        overallStatus = 'unhealthy';
      } else if (hasDisconnected || hasDegraded) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: serviceName,
        version: serviceVersion,
        environment: process.env.NODE_ENV || 'development',
        dependencies: {
          database: databaseHealth,
          ...(redisHealth && { redis: redisHealth }),
          ...(rateLimitHealth && { rateLimiting: rateLimitHealth }),
        },
      };

      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: serviceName,
        version: serviceVersion,
        environment: process.env.NODE_ENV || 'development',
        dependencies: {
          database: { status: 'error', error: 'Health check failed' },
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return errorResult;
    }
  };
};

export const createReadinessCheckHandler = (
  serviceName: string,
  serviceVersion: string,
  dependencies: {
    database: DatabaseService;
    redis?: RedisService;
  }
) => {
  return async (): Promise<{
    status: 'ready' | 'not ready';
    service: string;
    version: string;
    timestamp: string;
    dependencies: Record<string, string>;
    error?: string;
  }> => {
    try {
      // Readiness requires all critical dependencies to be working
      const dbStatus = dependencies.database.getConnectionStatus();
      let redisStatus = true; // Redis is optional for readiness

      if (dependencies.redis) {
        redisStatus = dependencies.redis.isClientConnected();
      }

      const isReady = dbStatus && redisStatus;

      return {
        status: isReady ? 'ready' : 'not ready',
        service: serviceName,
        version: serviceVersion,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: dbStatus ? 'ready' : 'not ready',
          ...(dependencies.redis && { redis: redisStatus ? 'ready' : 'not ready' }),
        },
      };
    } catch (error) {
      return {
        status: 'not ready',
        service: serviceName,
        version: serviceVersion,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: 'error',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}; 