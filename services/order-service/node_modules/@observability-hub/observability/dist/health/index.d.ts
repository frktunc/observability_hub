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
export declare const createHealthCheckHandler: (serviceName: string, serviceVersion: string, dependencies: {
    database: DatabaseService;
    redis?: RedisService;
    rateLimiting?: RateLimitService;
}) => () => Promise<HealthCheckResult>;
export declare const createReadinessCheckHandler: (serviceName: string, serviceVersion: string, dependencies: {
    database: DatabaseService;
    redis?: RedisService;
}) => () => Promise<{
    status: "ready" | "not ready";
    service: string;
    version: string;
    timestamp: string;
    dependencies: Record<string, string>;
    error?: string;
}>;
//# sourceMappingURL=index.d.ts.map