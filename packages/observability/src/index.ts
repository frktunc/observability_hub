// ==============================================
// @observability-hub/observability
// Complete Observability Solution for Microservices
// ==============================================

import type { LoggerConfig } from './logger/types';
import type { RedisConfig } from './redis';

// ===== TRACING EXPORTS =====
export { initTracer } from './tracing';

// ===== LOGGER EXPORTS =====
export { ObservabilityLogger } from './logger/logger';
export type { 
  LoggerConfig,
  LogLevel,
  LogContext,
  BusinessEvent,
  LogMessage 
} from './logger/types';

// ===== CONFIGURATION EXPORTS =====
export { 
  createObservabilityConfigSchema,
  createDerivedConfig,
  serviceConfigs 
} from './config';

// ===== REDIS EXPORTS =====
export { 
  RedisClient,
  createRedisClient,
  createRedisService 
} from './redis';
export type { RedisConfig } from './redis';

// ===== HEALTH CHECK EXPORTS =====
export {
  createHealthCheckHandler,
  createReadinessCheckHandler
} from './health';
export type {
  DependencyHealth,
  HealthCheckResult,
  DatabaseService,
  RedisService as HealthRedisService,
  RateLimitService
} from './health';

// ===== MIDDLEWARE EXPORTS =====
// Note: Middleware requires service-specific configuration
// Will be exported separately when needed

// ===== UTILS & HELPERS =====
// Temporarily disabled due to configuration dependencies
// export { 
//   createCircuitBreakerConfig,
//   createMonitoringSetup,
//   createObservabilityFactory 
// } from './utils';

// ===== TYPE AGGREGATIONS =====
export type ObservabilityConfig = {
  serviceName: string;
  serviceVersion: string;
  environment: 'development' | 'staging' | 'production';
  logger: LoggerConfig;
  redis: RedisConfig;
  circuitBreaker: {
    enabled: boolean;
    timeout: number;
    errorThreshold: number;
    resetTimeout: number;
  };
};

// ===== FACTORY FUNCTION =====
import { ObservabilityLogger } from './logger/logger';
import { createRedisService } from './redis';
import { createHealthCheckHandler } from './health';
import { createObservabilityConfigSchema } from './config';

export const createObservabilitySetup = (serviceName: string, config: Partial<ObservabilityConfig> = {}) => {
  return {
    logger: new ObservabilityLogger({
      serviceName,
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: config.environment || 'development',
      ...config.logger
    }),
    
    redis: config.redis ? createRedisService(config.redis, serviceName) : null,
    
    healthCheck: createHealthCheckHandler(
      serviceName,
      config.serviceVersion || '1.0.0',
      {} as any // Will be filled by service implementation
    ),
    
    config: createObservabilityConfigSchema(serviceName, 8080, 9090)
  };
};

// ===== DEFAULT EXPORTS =====
export default {
  ObservabilityLogger,
  createObservabilityConfigSchema,
  createRedisClient: require('./redis').createRedisClient,
  createHealthCheckHandler,
  createObservabilitySetup
};
