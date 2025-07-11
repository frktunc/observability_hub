import Redis from 'ioredis';
export declare class RedisClient {
    private client;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): Redis;
    isClientConnected(): boolean;
    ping(): Promise<string>;
    incrementCounter(key: string, ttl: number): Promise<number>;
    getCounter(key: string): Promise<number>;
    getTTL(key: string): Promise<number>;
    setKeyWithTTL(key: string, value: string | number, ttlSeconds: number): Promise<void>;
    deleteKey(key: string): Promise<number>;
    getKeys(pattern: string): Promise<string[]>;
    healthCheck(): Promise<{
        status: string;
        latency?: number;
        error?: string;
    }>;
}
export declare const getRedisClient: () => RedisClient;
export declare const initializeRedis: () => Promise<RedisClient>;
export declare const closeRedis: () => Promise<void>;
//# sourceMappingURL=redis-client.d.ts.map