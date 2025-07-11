import { Request, Response, NextFunction } from 'express';
interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
}
declare class RateLimitingMiddleware {
    private redisLimiter;
    private memoryLimiter;
    private isRedisEnabled;
    constructor();
    private initializeRedisLimiter;
    private generateKey;
    private getRateLimitInfo;
    private setRateLimitHeaders;
    middleware(req: Request, res: Response, next: NextFunction): Promise<void>;
    resetKey(key: string): Promise<void>;
    getStatus(key: string): Promise<RateLimitInfo | null>;
    healthCheck(): Promise<{
        redis: boolean;
        memory: boolean;
        activeBackend: string;
    }>;
}
export declare const getRateLimitingMiddleware: () => RateLimitingMiddleware;
export declare const createRateLimitMiddleware: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const resetRateLimit: (key: string) => Promise<void>;
export declare const getRateLimitStatus: (key: string) => Promise<RateLimitInfo | null>;
export declare const rateLimitHealthCheck: () => Promise<{
    redis: boolean;
    memory: boolean;
    activeBackend: string;
}>;
export {};
//# sourceMappingURL=rate-limiting.d.ts.map