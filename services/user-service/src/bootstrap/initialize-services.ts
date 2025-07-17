import { derivedConfig } from '../config';
import { initializeRedis } from '../services/redis-client';

export async function initializeServices(): Promise<void> {
  try {
    if (derivedConfig.redis.rateLimiting.enabled) {
      await initializeRedis();
      console.log('🎯 Redis services initialized successfully');
    } else {
      console.log('⚠️ Redis rate limiting disabled, using memory fallback');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Redis, falling back to memory rate limiting:', error);
    // Don't throw error - let the app continue with memory fallback
  }
} 