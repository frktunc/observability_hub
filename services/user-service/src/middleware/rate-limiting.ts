import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, IRateLimiterOptions } from 'rate-limiter-flexible';
import { getRedisClient } from '../services/redis-client';
import { config, derivedConfig } from '../config';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

class RateLimitingMiddleware {
  private redisLimiter: RateLimiterRedis | null = null;
  private memoryLimiter: RateLimiterMemory;
  private isRedisEnabled: boolean;

  constructor() {
    this.isRedisEnabled = derivedConfig.redis.rateLimiting.enabled;
    
    const rateLimiterOptions: IRateLimiterOptions = {
      keyPrefix: derivedConfig.redis.rateLimiting.prefix,
      points: derivedConfig.redis.rateLimiting.maxRequests, // Maximum requests
      duration: Math.ceil(derivedConfig.redis.rateLimiting.windowMs / 1000), // Window in seconds
      blockDuration: Math.ceil(derivedConfig.redis.rateLimiting.windowMs / 1000), // Block for the same duration
      execEvenly: true, // Distribute requests evenly across the duration
    };

    // Initialize memory limiter as fallback
    this.memoryLimiter = new RateLimiterMemory(rateLimiterOptions);

    // Initialize Redis limiter if enabled
    if (this.isRedisEnabled) {
      this.initializeRedisLimiter(rateLimiterOptions);
    }
  }

  private initializeRedisLimiter(options: IRateLimiterOptions): void {
    try {
      const redisClient = getRedisClient();
      
      this.redisLimiter = new RateLimiterRedis({
        ...options,
        storeClient: redisClient.getClient(),
        insuranceLimiter: this.memoryLimiter, // Fallback to memory if Redis fails
      });

      console.log('✅ Redis rate limiter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Redis rate limiter, falling back to memory:', error);
      this.redisLimiter = null;
    }
  }

  private generateKey(req: Request): string {
    // Multi-tenant rate limiting key
    const tenantId = req.headers[config.TENANT_HEADER_NAME] || config.DEFAULT_TENANT_ID;
    const clientId = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Include endpoint path for more granular limiting
    const endpoint = req.route?.path || req.path;
    
    return `${tenantId}:${clientId}:${endpoint}:${userAgent.slice(0, 50)}`;
  }

  private async getRateLimitInfo(remainingPoints: number, msBeforeNext: number): Promise<RateLimitInfo> {
    const limit = derivedConfig.redis.rateLimiting.maxRequests;
    const remaining = Math.max(0, remainingPoints);
    const reset = new Date(Date.now() + msBeforeNext);
    const retryAfter = msBeforeNext > 0 ? Math.ceil(msBeforeNext / 1000) : undefined;

    return { limit, remaining, reset, retryAfter };
  }

  private setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
    res.set({
      'X-RateLimit-Limit': info.limit.toString(),
      'X-RateLimit-Remaining': info.remaining.toString(),
      'X-RateLimit-Reset': info.reset.toISOString(),
    });

    if (info.retryAfter) {
      res.set('Retry-After', info.retryAfter.toString());
    }
  }

  async middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = this.generateKey(req);
      const limiter = this.redisLimiter || this.memoryLimiter;

      // Try to consume a point
      const result = await limiter.consume(key);
      
      // Set rate limit headers
      const info = await this.getRateLimitInfo(result.remainingPoints || 0, result.msBeforeNext || 0);
      this.setRateLimitHeaders(res, info);

      next();
    } catch (rejectedResult: any) {
      // Rate limit exceeded
      const info = await this.getRateLimitInfo(
        rejectedResult.remainingPoints || 0,
        rejectedResult.msBeforeNext || 0
      );
      
      this.setRateLimitHeaders(res, info);

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: info.retryAfter,
        limit: info.limit,
        remaining: info.remaining,
        reset: info.reset,
      });
    }
  }

  // Method to reset rate limits for a specific key (useful for testing or admin operations)
  async resetKey(key: string): Promise<void> {
    try {
      const limiter = this.redisLimiter || this.memoryLimiter;
      await limiter.delete(key);
      console.log(`Rate limit reset for key: ${key}`);
    } catch (error) {
      console.error(`Failed to reset rate limit for key ${key}:`, error);
      throw error;
    }
  }

  // Method to get current rate limit status for a key
  async getStatus(key: string): Promise<RateLimitInfo | null> {
    try {
      const limiter = this.redisLimiter || this.memoryLimiter;
      const result = await limiter.get(key);
      
      if (!result) {
        return null;
      }

      return await this.getRateLimitInfo(result.remainingPoints || 0, result.msBeforeNext || 0);
    } catch (error) {
      console.error(`Failed to get rate limit status for key ${key}:`, error);
      return null;
    }
  }

  // Health check method
  async healthCheck(): Promise<{ redis: boolean; memory: boolean; activeBackend: string }> {
    return {
      redis: this.redisLimiter !== null,
      memory: true,
      activeBackend: this.redisLimiter ? 'redis' : 'memory',
    };
  }
}

// Singleton instance
let rateLimitingMiddleware: RateLimitingMiddleware | null = null;

export const getRateLimitingMiddleware = (): RateLimitingMiddleware => {
  if (!rateLimitingMiddleware) {
    rateLimitingMiddleware = new RateLimitingMiddleware();
  }
  return rateLimitingMiddleware;
};

export const createRateLimitMiddleware = () => {
  const middleware = getRateLimitingMiddleware();
  return middleware.middleware.bind(middleware);
};

// Export individual functions for testing and admin operations
export const resetRateLimit = async (key: string): Promise<void> => {
  const middleware = getRateLimitingMiddleware();
  await middleware.resetKey(key);
};

export const getRateLimitStatus = async (key: string): Promise<RateLimitInfo | null> => {
  const middleware = getRateLimitingMiddleware();
  return await middleware.getStatus(key);
};

export const rateLimitHealthCheck = async () => {
  const middleware = getRateLimitingMiddleware();
  return await middleware.healthCheck();
}; 