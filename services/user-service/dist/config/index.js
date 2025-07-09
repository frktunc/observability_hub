"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfiguration = exports.derivedConfig = exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Configuration schema with validation
const configSchema = zod_1.z.object({
    // Application
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().min(1).max(65535).default(3000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    // Service Identity
    SERVICE_NAME: zod_1.z.string().default('user-service'),
    SERVICE_VERSION: zod_1.z.string().default('1.0.0'),
    SERVICE_INSTANCE_ID: zod_1.z.string().optional(),
    // RabbitMQ Configuration
    RABBITMQ_URL: zod_1.z.string().default('amqp://obs_user:obs_password@obs_rabbitmq:5672/'),
    RABBITMQ_VHOST: zod_1.z.string().default('/'),
    RABBITMQ_EXCHANGE: zod_1.z.string().default('logs.topic'),
    RABBITMQ_CONNECTION_TIMEOUT: zod_1.z.coerce.number().default(30000),
    RABBITMQ_HEARTBEAT: zod_1.z.coerce.number().default(60),
    RABBITMQ_MAX_RETRIES: zod_1.z.coerce.number().default(5),
    RABBITMQ_RETRY_DELAY: zod_1.z.coerce.number().default(2000),
    
    // Logging Configuration
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    LOG_FORMAT: zod_1.z.enum(['json', 'pretty']).default('json'),
    LOG_MAX_FILE_SIZE: zod_1.z.string().default('20m'),
    LOG_MAX_FILES: zod_1.z.string().default('14d'),
    LOG_DATE_PATTERN: zod_1.z.string().default('YYYY-MM-DD'),
    // Metrics Configuration
    METRICS_ENABLED: zod_1.z.coerce.boolean().default(true),
    METRICS_PORT: zod_1.z.coerce.number().min(1).max(65535).default(9090),
    METRICS_PATH: zod_1.z.string().default('/metrics'),
    // Health Check Configuration
    HEALTH_CHECK_ENABLED: zod_1.z.coerce.boolean().default(true),
    HEALTH_CHECK_PATH: zod_1.z.string().default('/health'),
    HEALTH_CHECK_TIMEOUT: zod_1.z.coerce.number().default(5000),
    // Rate Limiting
    RATE_LIMIT_ENABLED: zod_1.z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().default(60000), // 1 minute
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().default(1000),
    // Circuit Breaker
    CIRCUIT_BREAKER_ENABLED: zod_1.z.coerce.boolean().default(true),
    CIRCUIT_BREAKER_TIMEOUT: zod_1.z.coerce.number().default(3000),
    CIRCUIT_BREAKER_ERROR_THRESHOLD: zod_1.z.coerce.number().min(0).max(100).default(50),
    CIRCUIT_BREAKER_RESET_TIMEOUT: zod_1.z.coerce.number().default(30000),
    // Performance Tuning
    MAX_CONCURRENT_CONNECTIONS: zod_1.z.coerce.number().default(100),
    KEEP_ALIVE_TIMEOUT: zod_1.z.coerce.number().default(5000),
    HEADERS_TIMEOUT: zod_1.z.coerce.number().default(10000),
    REQUEST_TIMEOUT: zod_1.z.coerce.number().default(30000),
    // Multi-tenant support
    TENANT_HEADER_NAME: zod_1.z.string().default('x-tenant-id'),
    DEFAULT_TENANT_ID: zod_1.z.string().default('default'),
    // Feature Flags
    FEATURE_BATCH_PROCESSING: zod_1.z.coerce.boolean().default(true),
    FEATURE_COMPRESSION: zod_1.z.coerce.boolean().default(true),
    FEATURE_CORRELATION_ID_GENERATION: zod_1.z.coerce.boolean().default(true),
});
// Parse and validate configuration
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
// Derived configuration
exports.derivedConfig = {
    isDevelopment: exports.config.NODE_ENV === 'development',
    isProduction: exports.config.NODE_ENV === 'production',
    // isTesting: config.NODE_ENV === 'testing',
    // Service URLs
    httpUrl: `http://${exports.config.HOST}:${exports.config.PORT}`,
    metricsUrl: `http://${exports.config.HOST}:${exports.config.METRICS_PORT}${exports.config.METRICS_PATH}`,
    // RabbitMQ routing
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
   
};
// Configuration validation and startup info
const validateConfiguration = () => {
    console.log('🔧 Configuration validated successfully');
    if (exports.config.NODE_ENV === 'development') {
        console.log('📋 Configuration summary:');
        console.log(`  Service: ${exports.config.SERVICE_NAME}@${exports.config.SERVICE_VERSION}`);
        console.log(`  HTTP: ${exports.derivedConfig.httpUrl}`);
        console.log(`  Environment: ${exports.config.NODE_ENV}`);
        console.log(`  Log Level: ${exports.config.LOG_LEVEL}`);
        console.log(`  RabbitMQ: ${exports.config.RABBITMQ_URL}`);
    }
};
exports.validateConfiguration = validateConfiguration;
//# sourceMappingURL=index.js.map