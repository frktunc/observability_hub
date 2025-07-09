"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = exports.initializeRedis = exports.getRedisClient = exports.RedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
class RedisClient {
    client;
    isConnected = false;
    constructor() {
        const redisConfig = config_1.derivedConfig.redis;
        this.client = new ioredis_1.default({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
            connectTimeout: redisConfig.connectionTimeout,
            commandTimeout: redisConfig.commandTimeout,
            maxRetriesPerRequest: redisConfig.retryOptions.maxRetries,
            retryStrategy: (times) => {
                const delay = Math.min(times * redisConfig.retryOptions.retryDelayMs, 10000);
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
            console.log('🔗 Redis connected successfully');
            this.isConnected = true;
        });
        this.client.on('ready', () => {
            console.log('✅ Redis is ready to accept commands');
        });
        this.client.on('error', (error) => {
            console.error('❌ Redis connection error:', error);
            this.isConnected = false;
        });
        this.client.on('close', () => {
            console.log('🔌 Redis connection closed');
            this.isConnected = false;
        });
        this.client.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });
    }
    async connect() {
        try {
            await this.client.connect();
            console.log('🎯 Redis client initialized successfully');
        }
        catch (error) {
            console.error('💥 Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
            console.log('👋 Redis client disconnected');
        }
        catch (error) {
            console.error('❌ Error disconnecting from Redis:', error);
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
            console.error('Redis ping failed:', error);
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
// Singleton instance
let redisClient = null;
const getRedisClient = () => {
    if (!redisClient) {
        redisClient = new RedisClient();
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const initializeRedis = async () => {
    const client = (0, exports.getRedisClient)();
    await client.connect();
    return client;
};
exports.initializeRedis = initializeRedis;
const closeRedis = async () => {
    if (redisClient) {
        await redisClient.disconnect();
        redisClient = null;
    }
};
exports.closeRedis = closeRedis;
//# sourceMappingURL=redis-client.js.map