import { createRedisService } from '@observability-hub/observability/redis';
import { derivedConfig } from '../config';
import { logger } from '../bootstrap/logger';

// Transform config to match observability RedisConfig interface
const redisConfig = {
  host: derivedConfig.redis.host,
  port: derivedConfig.redis.port,
  password: derivedConfig.redis.password,
  db: derivedConfig.redis.db,
  connectionTimeout: derivedConfig.redis.connectionTimeout,
  commandTimeout: derivedConfig.redis.commandTimeout,
  maxRetries: derivedConfig.redis.retryOptions.maxRetries,
  retryDelay: derivedConfig.redis.retryOptions.retryDelayMs,
};

// Use observability package's Redis utilities
const redisService = createRedisService(redisConfig, 'user-service', logger);

export const {
  getRedisClient,
  initializeRedis,
  closeRedis
} = redisService;

// Re-export types for compatibility
export type { RedisClient } from '@observability-hub/observability/redis'; 