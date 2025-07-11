"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisService = exports.createRedisClient = exports.RedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class RedisClient {
    constructor(config, serviceName) {
        this.isConnected = false;
        this.serviceName = serviceName;
        this.client = new ioredis_1.default({
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db,
            connectTimeout: config.connectionTimeout,
            commandTimeout: config.commandTimeout,
            maxRetriesPerRequest: config.maxRetries,
            retryStrategy: (times) => {
                const delay = Math.min(times * config.retryDelay, 10000);
                return delay;
            },
            lazyConnect: true,
            keepAlive: 30000,
            family: 4, // 4 (IPv4) or 6 (IPv6)
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
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
    async connect() {
        try {
            await this.client.connect();
            console.log(`🎯 [${this.serviceName}] Redis client initialized successfully`);
        }
        catch (error) {
            console.error(`💥 [${this.serviceName}] Failed to connect to Redis:`, error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
            console.log(`👋 [${this.serviceName}] Redis client disconnected`);
        }
        catch (error) {
            console.error(`❌ [${this.serviceName}] Error disconnecting from Redis:`, error);
            throw error;
        }
    }
    getClient() {
        return this.client;
    }
    isClientConnected() {
        return this.isConnected && this.client.status === 'ready';
    }
    async ping() {
        try {
            return await this.client.ping();
        }
        catch (error) {
            console.error(`[${this.serviceName}] Redis ping failed:`, error);
            throw error;
        }
    }
    // Rate limiting specific methods
    async incrementCounter(key, ttl) {
        const pipeline = this.client.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, Math.ceil(ttl / 1000));
        const results = await pipeline.exec();
        if (!results || !results[0] || results[0][1] === null || results[0][1] === undefined) {
            throw new Error('Failed to increment counter');
        }
        return results[0][1];
    }
    async getCounter(key) {
        const value = await this.client.get(key);
        return value ? parseInt(value, 10) : 0;
    }
    async getTTL(key) {
        return await this.client.ttl(key);
    }
    async setKeyWithTTL(key, value, ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value.toString());
    }
    async deleteKey(key) {
        return await this.client.del(key);
    }
    async getKeys(pattern) {
        return await this.client.keys(pattern);
    }
    // Health check method
    async healthCheck() {
        try {
            const start = Date.now();
            await this.ping();
            const latency = Date.now() - start;
            return {
                status: 'connected',
                latency,
            };
        }
        catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.RedisClient = RedisClient;
// Factory function for creating Redis client instances
const createRedisClient = (config, serviceName) => {
    return new RedisClient(config, serviceName);
};
exports.createRedisClient = createRedisClient;
// Singleton pattern for services
const createRedisService = (config, serviceName) => {
    let redisClient = null;
    const getRedisClient = () => {
        if (!redisClient) {
            redisClient = new RedisClient(config, serviceName);
        }
        return redisClient;
    };
    const initializeRedis = async () => {
        const client = getRedisClient();
        await client.connect();
        return client;
    };
    const closeRedis = async () => {
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
exports.createRedisService = createRedisService;
//# sourceMappingURL=index.js.map