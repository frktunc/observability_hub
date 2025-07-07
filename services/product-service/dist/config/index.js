"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfiguration = exports.derivedConfig = exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().min(1).max(65535).default(3003),
    HOST: zod_1.z.string().default('0.0.0.0'),
    SERVICE_NAME: zod_1.z.string().default('product-service'),
    SERVICE_VERSION: zod_1.z.string().default('1.0.0'),
    SERVICE_INSTANCE_ID: zod_1.z.string().optional(),
    DATABASE_URL: zod_1.z.string().default('postgresql://product_service_user:product_service_password@product_service_db:5432/product_service_db'),
    DATABASE_HOST: zod_1.z.string().default('product_service_db'),
    DATABASE_PORT: zod_1.z.coerce.number().default(5432),
    DATABASE_NAME: zod_1.z.string().default('product_service_db'),
    DATABASE_USER: zod_1.z.string().default('product_service_user'),
    DATABASE_PASSWORD: zod_1.z.string().default('product_service_password'),
    DATABASE_POOL_MIN: zod_1.z.coerce.number().default(2),
    DATABASE_POOL_MAX: zod_1.z.coerce.number().default(10),
    DATABASE_TIMEOUT: zod_1.z.coerce.number().default(5000),
    RABBITMQ_URL: zod_1.z.string().default('amqp://obs_user:obs_secure_password_2024@localhost:5672'),
    RABBITMQ_VHOST: zod_1.z.string().default('/observability'),
    RABBITMQ_EXCHANGE: zod_1.z.string().default('logs.topic'),
    RABBITMQ_CONNECTION_TIMEOUT: zod_1.z.coerce.number().default(30000),
    RABBITMQ_HEARTBEAT: zod_1.z.coerce.number().default(60),
    RABBITMQ_MAX_RETRIES: zod_1.z.coerce.number().default(5),
    RABBITMQ_RETRY_DELAY: zod_1.z.coerce.number().default(2000),
    GRPC_PORT: zod_1.z.coerce.number().min(1).max(65535).default(50053),
    GRPC_HOST: zod_1.z.string().default('0.0.0.0'),
    GRPC_MAX_RECEIVE_MESSAGE_LENGTH: zod_1.z.coerce.number().default(4 * 1024 * 1024),
    GRPC_MAX_SEND_MESSAGE_LENGTH: zod_1.z.coerce.number().default(4 * 1024 * 1024),
    GRPC_KEEPALIVE_TIME: zod_1.z.coerce.number().default(30000),
    GRPC_KEEPALIVE_TIMEOUT: zod_1.z.coerce.number().default(5000),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    LOG_FORMAT: zod_1.z.enum(['json', 'pretty']).default('json'),
    LOG_MAX_FILE_SIZE: zod_1.z.string().default('20m'),
    LOG_MAX_FILES: zod_1.z.string().default('14d'),
    LOG_DATE_PATTERN: zod_1.z.string().default('YYYY-MM-DD'),
    METRICS_ENABLED: zod_1.z.coerce.boolean().default(true),
    METRICS_PORT: zod_1.z.coerce.number().min(1).max(65535).default(9092),
    METRICS_PATH: zod_1.z.string().default('/metrics'),
    HEALTH_CHECK_ENABLED: zod_1.z.coerce.boolean().default(true),
    HEALTH_CHECK_PATH: zod_1.z.string().default('/health'),
    HEALTH_CHECK_TIMEOUT: zod_1.z.coerce.number().default(5000),
    RATE_LIMIT_ENABLED: zod_1.z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().default(60000),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().default(1000),
    CIRCUIT_BREAKER_ENABLED: zod_1.z.coerce.boolean().default(true),
    CIRCUIT_BREAKER_TIMEOUT: zod_1.z.coerce.number().default(3000),
    CIRCUIT_BREAKER_ERROR_THRESHOLD: zod_1.z.coerce.number().min(0).max(100).default(50),
    CIRCUIT_BREAKER_RESET_TIMEOUT: zod_1.z.coerce.number().default(30000),
    MAX_CONCURRENT_CONNECTIONS: zod_1.z.coerce.number().default(100),
    KEEP_ALIVE_TIMEOUT: zod_1.z.coerce.number().default(5000),
    HEADERS_TIMEOUT: zod_1.z.coerce.number().default(10000),
    REQUEST_TIMEOUT: zod_1.z.coerce.number().default(30000),
    TENANT_HEADER_NAME: zod_1.z.string().default('x-tenant-id'),
    DEFAULT_TENANT_ID: zod_1.z.string().default('default'),
    FEATURE_BATCH_PROCESSING: zod_1.z.coerce.boolean().default(true),
    FEATURE_COMPRESSION: zod_1.z.coerce.boolean().default(true),
    FEATURE_CORRELATION_ID_GENERATION: zod_1.z.coerce.boolean().default(true),
});
const parseConfig = () => {
    try {
        return configSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('❌ Configuration validation failed:');
            error.errors.forEach((err) => {
                console.error(`  ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};
exports.config = parseConfig();
exports.derivedConfig = {
    isDevelopment: exports.config.NODE_ENV === 'development',
    isProduction: exports.config.NODE_ENV === 'production',
    httpUrl: `http://${exports.config.HOST}:${exports.config.PORT}`,
    grpcUrl: `${exports.config.GRPC_HOST}:${exports.config.GRPC_PORT}`,
    metricsUrl: `http://${exports.config.HOST}:${exports.config.METRICS_PORT}${exports.config.METRICS_PATH}`,
    database: {
        url: exports.config.DATABASE_URL,
        host: exports.config.DATABASE_HOST,
        port: exports.config.DATABASE_PORT,
        name: exports.config.DATABASE_NAME,
        user: exports.config.DATABASE_USER,
        password: exports.config.DATABASE_PASSWORD,
        pool: {
            min: exports.config.DATABASE_POOL_MIN,
            max: exports.config.DATABASE_POOL_MAX,
        },
        timeout: exports.config.DATABASE_TIMEOUT,
    },
    rabbitmq: {
        url: exports.config.RABBITMQ_URL,
        vhost: exports.config.RABBITMQ_VHOST,
        exchange: exports.config.RABBITMQ_EXCHANGE,
        routingKeys: {
            info: 'logs.info',
            warning: 'logs.warning',
            error: 'logs.error',
            debug: 'logs.debug',
            all: 'logs.*'
        },
        connectionOptions: {
            heartbeat: exports.config.RABBITMQ_HEARTBEAT,
            timeout: exports.config.RABBITMQ_CONNECTION_TIMEOUT,
        },
        retryOptions: {
            maxRetries: exports.config.RABBITMQ_MAX_RETRIES,
            retryDelayMs: exports.config.RABBITMQ_RETRY_DELAY,
        }
    },
    grpc: {
        options: {
            'grpc.keepalive_time_ms': exports.config.GRPC_KEEPALIVE_TIME,
            'grpc.keepalive_timeout_ms': exports.config.GRPC_KEEPALIVE_TIMEOUT,
            'grpc.keepalive_permit_without_calls': true,
            'grpc.http2.max_pings_without_data': 0,
            'grpc.http2.min_time_between_pings_ms': 10000,
            'grpc.http2.min_ping_interval_without_data_ms': 5 * 60 * 1000,
            'grpc.max_receive_message_length': exports.config.GRPC_MAX_RECEIVE_MESSAGE_LENGTH,
            'grpc.max_send_message_length': exports.config.GRPC_MAX_SEND_MESSAGE_LENGTH,
        }
    }
};
const validateConfiguration = () => {
    console.log('🔧 Configuration validated successfully');
    if (exports.config.NODE_ENV === 'development') {
        console.log('📋 Configuration summary:');
        console.log(`  Service: ${exports.config.SERVICE_NAME}@${exports.config.SERVICE_VERSION}`);
        console.log(`  HTTP: ${exports.derivedConfig.httpUrl}`);
        console.log(`  gRPC: ${exports.derivedConfig.grpcUrl}`);
        console.log(`  Environment: ${exports.config.NODE_ENV}`);
        console.log(`  Log Level: ${exports.config.LOG_LEVEL}`);
        console.log(`  RabbitMQ: ${exports.config.RABBITMQ_URL}`);
    }
};
exports.validateConfiguration = validateConfiguration;
//# sourceMappingURL=index.js.map