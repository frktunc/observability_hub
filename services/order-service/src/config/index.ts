import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema with validation
const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  
  // Service Identity
  SERVICE_NAME: z.string().default('order-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  SERVICE_INSTANCE_ID: z.string().optional(),
  
  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://order_service_user:order_service_password@order_service_db:5432/order_service_db'),
  DATABASE_HOST: z.string().default('order_service_db'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('order_service_db'),
  DATABASE_USER: z.string().default('order_service_user'),
  DATABASE_PASSWORD: z.string().default('order_service_password'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_TIMEOUT: z.coerce.number().default(5000),
  
  // RabbitMQ Configuration
  RABBITMQ_URL: z.string().nonempty(),
  RABBITMQ_HOSTNAME: z.string().default('rabbitmq'),
  RABBITMQ_PORT: z.coerce.number().default(5672),
  RABBITMQ_USER: z.string().default('obs_user'),
  RABBITMQ_PASSWORD: z.string().default('obs_password'),
  RABBITMQ_VHOST: z.string().nonempty(),
  RABBITMQ_EXCHANGE: z.string().default('logs.topic'),
  RABBITMQ_CONNECTION_TIMEOUT: z.coerce.number().default(30000),
  RABBITMQ_HEARTBEAT: z.coerce.number().default(60),
  RABBITMQ_MAX_RETRIES: z.coerce.number().default(5),
  RABBITMQ_RETRY_DELAY: z.coerce.number().default(2000),
  

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_MAX_FILE_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().default('14d'),
  LOG_DATE_PATTERN: z.string().default('YYYY-MM-DD'),
  
  // Metrics Configuration
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().min(1).max(65535).default(9091),
  METRICS_PATH: z.string().default('/metrics'),
  
  // Health Check Configuration
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_PATH: z.string().default('/health'),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
  
  // Redis Configuration (ADDED FOR OBSERVABILITY CONSISTENCY)
  REDIS_HOST: z.string().default('obs_redis'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(3), // Different DB: user-service=1, product-service=2, order-service=3
  REDIS_CONNECTION_TIMEOUT: z.coerce.number().default(5000),
  REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),
  REDIS_MAX_RETRIES: z.coerce.number().default(3),
  REDIS_RETRY_DELAY: z.coerce.number().default(1000),
  
  // Rate Limiting (UPGRADED FOR REDIS SUPPORT)
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(150), // Higher for order service
  RATE_LIMIT_REDIS_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_REDIS_PREFIX: z.string().default('rl:order-service:'),
  
  // Circuit Breaker
  CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().default(true),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(3000),
  CIRCUIT_BREAKER_ERROR_THRESHOLD: z.coerce.number().min(0).max(100).default(50),
  CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().default(30000),
  
  // Performance Tuning
  MAX_CONCURRENT_CONNECTIONS: z.coerce.number().default(100),
  KEEP_ALIVE_TIMEOUT: z.coerce.number().default(5000),
  HEADERS_TIMEOUT: z.coerce.number().default(10000),
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
  
  // Multi-tenant support
  TENANT_HEADER_NAME: z.string().default('x-tenant-id'),
  DEFAULT_TENANT_ID: z.string().default('default'),
  
  // Feature Flags
  FEATURE_BATCH_PROCESSING: z.coerce.boolean().default(true),
  FEATURE_COMPRESSION: z.coerce.boolean().default(true),
  FEATURE_CORRELATION_ID_GENERATION: z.coerce.boolean().default(true),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseConfig();

// Derived configuration
export const derivedConfig = {
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  
  // Service URLs
  httpUrl: `http://${config.HOST}:${config.PORT}`,
  metricsUrl: `http://${config.HOST}:${config.METRICS_PORT}${config.METRICS_PATH}`,
  
  // Database configuration
  database: {
    url: config.DATABASE_URL,
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    name: config.DATABASE_NAME,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    pool: {
      min: config.DATABASE_POOL_MIN,
      max: config.DATABASE_POOL_MAX,
    },
    timeout: config.DATABASE_TIMEOUT,
  },
  
  // RabbitMQ routing
  rabbitmq: {
    url: config.RABBITMQ_URL,
    hostname: config.RABBITMQ_HOSTNAME,
    port: config.RABBITMQ_PORT,
    user: config.RABBITMQ_USER,
    password: config.RABBITMQ_PASSWORD,
    vhost: config.RABBITMQ_VHOST,
    exchange: config.RABBITMQ_EXCHANGE,
    routingKeys: {
      info: 'logs.info',
      warning: 'logs.warning', 
      error: 'logs.error',
      debug: 'logs.debug',
      all: 'logs.*'
    },
    connectionOptions: {
      heartbeat: config.RABBITMQ_HEARTBEAT,
      timeout: config.RABBITMQ_CONNECTION_TIMEOUT,
    },
    retryOptions: {
      maxRetries: config.RABBITMQ_MAX_RETRIES,
      retryDelayMs: config.RABBITMQ_RETRY_DELAY,
    }
  },
  
  // Redis configuration (ADDED FOR OBSERVABILITY CONSISTENCY)
  redis: {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
    connectionTimeout: config.REDIS_CONNECTION_TIMEOUT,
    commandTimeout: config.REDIS_COMMAND_TIMEOUT,
    maxRetries: config.REDIS_MAX_RETRIES,
    retryDelay: config.REDIS_RETRY_DELAY,
    rateLimiting: {
      enabled: config.RATE_LIMIT_REDIS_ENABLED,
      prefix: config.RATE_LIMIT_REDIS_PREFIX,
    }
  },
  
  // Circuit breaker configuration (ADDED FOR OBSERVABILITY CONSISTENCY)
  circuitBreaker: {
    enabled: config.CIRCUIT_BREAKER_ENABLED,
    timeout: config.CIRCUIT_BREAKER_TIMEOUT,
    errorThreshold: config.CIRCUIT_BREAKER_ERROR_THRESHOLD,
    resetTimeout: config.CIRCUIT_BREAKER_RESET_TIMEOUT,
  }
  
};

// Configuration validation and startup info
export const validateConfiguration = (): void => {
  console.log('🔧 Configuration validated successfully');
  
  if (config.NODE_ENV === 'development') {
    console.log('📋 Configuration summary:');
    console.log(`  Service: ${config.SERVICE_NAME}@${config.SERVICE_VERSION}`);
    console.log(`  HTTP: ${derivedConfig.httpUrl}`);
    console.log(`  Environment: ${config.NODE_ENV}`);
    console.log(`  Log Level: ${config.LOG_LEVEL}`);
    console.log(`  RabbitMQ: ${config.RABBITMQ_URL}`);
  }
};

export type Config = typeof config;
export type DerivedConfig = typeof derivedConfig; 