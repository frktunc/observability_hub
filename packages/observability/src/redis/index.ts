import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectionTimeout: number;
  commandTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

export class RedisClient {
  private client: Redis;
  private isConnected = false;
  private serviceName: string;

  constructor(config: RedisConfig, serviceName: string) {
    this.serviceName = serviceName;
    
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: config.connectionTimeout,
      commandTimeout: config.commandTimeout,
      maxRetriesPerRequest: config.maxRetries,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * config.retryDelay, 10000);
        return delay;
      },
      lazyConnect: true,
      keepAlive: 30000,
      family: 4, // 4 (IPv4) or 6 (IPv6)
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log(`🔗 [${this.serviceName}] Redis connected successfully`);
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log(`✅ [${this.serviceName}] Redis is ready to accept commands`);
    });

    this.client.on('error', (error) => {
      console.error(`❌ [${this.serviceName}] Redis connection error:`, error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log(`🔌 [${this.serviceName}] Redis connection closed`);
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log(`🔄 [${this.serviceName}] Redis reconnecting...`);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log(`🎯 [${this.serviceName}] Redis client initialized successfully`);
    } catch (error) {
      console.error(`💥 [${this.serviceName}] Failed to connect to Redis:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      console.log(`👋 [${this.serviceName}] Redis client disconnected`);
    } catch (error) {
      console.error(`❌ [${this.serviceName}] Error disconnecting from Redis:`, error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      console.error(`[${this.serviceName}] Redis ping failed:`, error);
      throw error;
    }
  }

  // Rate limiting specific methods
  async incrementCounter(key: string, ttl: number): Promise<number> {
    const pipeline = this.client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(ttl / 1000));
    
    const results = await pipeline.exec();
    
    if (!results || !results[0] || results[0][1] === null || results[0][1] === undefined) {
      throw new Error('Failed to increment counter');
    }
    
    return results[0][1] as number;
  }

  async getCounter(key: string): Promise<number> {
    const value = await this.client.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async getTTL(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async setKeyWithTTL(key: string, value: string | number, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, value.toString());
  }

  async deleteKey(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async getKeys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'connected',
        latency,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Factory function for creating Redis client instances
export const createRedisClient = (config: RedisConfig, serviceName: string): RedisClient => {
  return new RedisClient(config, serviceName);
};

// Singleton pattern for services
export const createRedisService = (config: RedisConfig, serviceName: string) => {
  let redisClient: RedisClient | null = null;

  const getRedisClient = (): RedisClient => {
    if (!redisClient) {
      redisClient = new RedisClient(config, serviceName);
    }
    return redisClient;
  };

  const initializeRedis = async (): Promise<RedisClient> => {
    const client = getRedisClient();
    await client.connect();
    return client;
  };

  const closeRedis = async (): Promise<void> => {
    if (redisClient) {
      await redisClient.disconnect();
      redisClient = null;
    }
  };

  return {
    getRedisClient,
    initializeRedis,
    closeRedis
  };
};
