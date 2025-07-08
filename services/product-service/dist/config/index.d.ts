export declare const config: {
    NODE_ENV: "development" | "staging" | "production";
    PORT: number;
    HOST: string;
    SERVICE_NAME: string;
    SERVICE_VERSION: string;
    DATABASE_URL: string;
    DATABASE_HOST: string;
    DATABASE_PORT: number;
    DATABASE_NAME: string;
    DATABASE_USER: string;
    DATABASE_PASSWORD: string;
    DATABASE_POOL_MIN: number;
    DATABASE_POOL_MAX: number;
    DATABASE_TIMEOUT: number;
    RABBITMQ_URL: string;
    RABBITMQ_VHOST: string;
    RABBITMQ_EXCHANGE: string;
    RABBITMQ_CONNECTION_TIMEOUT: number;
    RABBITMQ_HEARTBEAT: number;
    RABBITMQ_MAX_RETRIES: number;
    RABBITMQ_RETRY_DELAY: number;
    GRPC_PORT: number;
    GRPC_HOST: string;
    GRPC_MAX_RECEIVE_MESSAGE_LENGTH: number;
    GRPC_MAX_SEND_MESSAGE_LENGTH: number;
    GRPC_KEEPALIVE_TIME: number;
    GRPC_KEEPALIVE_TIMEOUT: number;
    LOG_LEVEL: "error" | "warn" | "info" | "debug" | "trace";
    LOG_FORMAT: "json" | "pretty";
    LOG_MAX_FILE_SIZE: string;
    LOG_MAX_FILES: string;
    LOG_DATE_PATTERN: string;
    METRICS_ENABLED: boolean;
    METRICS_PORT: number;
    METRICS_PATH: string;
    HEALTH_CHECK_ENABLED: boolean;
    HEALTH_CHECK_PATH: string;
    HEALTH_CHECK_TIMEOUT: number;
    RATE_LIMIT_ENABLED: boolean;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    CIRCUIT_BREAKER_ENABLED: boolean;
    CIRCUIT_BREAKER_TIMEOUT: number;
    CIRCUIT_BREAKER_ERROR_THRESHOLD: number;
    CIRCUIT_BREAKER_RESET_TIMEOUT: number;
    MAX_CONCURRENT_CONNECTIONS: number;
    KEEP_ALIVE_TIMEOUT: number;
    HEADERS_TIMEOUT: number;
    REQUEST_TIMEOUT: number;
    TENANT_HEADER_NAME: string;
    DEFAULT_TENANT_ID: string;
    FEATURE_BATCH_PROCESSING: boolean;
    FEATURE_COMPRESSION: boolean;
    FEATURE_CORRELATION_ID_GENERATION: boolean;
    SERVICE_INSTANCE_ID?: string | undefined;
};
export declare const derivedConfig: {
    isDevelopment: boolean;
    isProduction: boolean;
    httpUrl: string;
 
    metricsUrl: string;
    database: {
        url: string;
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
        pool: {
            min: number;
            max: number;
        };
        timeout: number;
    };
    rabbitmq: {
        url: string;
        vhost: string;
        exchange: string;
        routingKeys: {
            info: string;
            warning: string;
            error: string;
            debug: string;
            all: string;
        };
        connectionOptions: {
            heartbeat: number;
            timeout: number;
        };
        retryOptions: {
            maxRetries: number;
            retryDelayMs: number;
        };
    };
};
export declare const validateConfiguration: () => void;
export type Config = typeof config;
export type DerivedConfig = typeof derivedConfig;
//# sourceMappingURL=index.d.ts.map