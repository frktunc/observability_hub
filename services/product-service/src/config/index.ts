import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema with validation
const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3003),
  HOST: z.string().default('0.0.0.0'),
  
  // Service Identity
  SERVICE_NAME: z.string().default('product-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
  SERVICE_INSTANCE_ID: z.string().optional(),
  
  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://product_service_user:product_service_password@product_service_db:5432/product_service_db'),
  DATABASE_HOST: z.string().default('product_service_db'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('product_service_db'),
  DATABASE_USER: z.string().default('product_service_user'),
  DATABASE_PASSWORD: z.string().default('product_service_password'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_TIMEOUT: z.coerce.number().default(5000),
  
  // RabbitMQ Configuration
  RABBITMQ_URL: z.string().default('amqp://obs_user:obs_secure_password_2024@localhost:5672'),
  RABBITMQ_VHOST: z.string().default('/observability'),
  RABBITMQ_EXCHANGE: z.string().default('logs.topic'),
  RABBITMQ_CONNECTION_TIMEOUT: z.coerce.number().default(30000),
  RABBITMQ_HEARTBEAT: z.coerce.number().default(60),
  RABBITMQ_MAX_RETRIES: z.coerce.number().default(5),
  RABBITMQ_RETRY_DELAY: z.coerce.number().default(2000),
  
  // gRPC Configuration  
  GRPC_PORT: z.coerce.number().min(1).max(65535).default(50053),
  GRPC_HOST: z.string().default('0.0.0.0'),
  GRPC_MAX_RECEIVE_MESSAGE_LENGTH: z.coerce.number().default(4 * 1024 * 1024), // 4MB
  GRPC_MAX_SEND_MESSAGE_LENGTH: z.coerce.number().default(4 * 1024 * 1024), // 4MB
  GRPC_KEEPALIVE_TIME: z.coerce.number().default(30000),
  GRPC_KEEPALIVE_TIMEOUT: z.coerce.number().default(5000),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_MAX_FILE_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().default('14d'),
  LOG_DATE_PATTERN: z.string().default('YYYY-MM-DD'),
  
  // Metrics Configuration
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().min(1).max(65535).default(9092),
  METRICS_PATH: z.string().default('/metrics'),
  
  // Health Check Configuration
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_PATH: z.string().default('/health'),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  
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
  grpcUrl: `${config.GRPC_HOST}:${config.GRPC_PORT}`,
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
  
  // gRPC options
  grpc: {
    options: {
      'grpc.keepalive_time_ms': config.GRPC_KEEPALIVE_TIME,
      'grpc.keepalive_timeout_ms': config.GRPC_KEEPALIVE_TIMEOUT,
      'grpc.keepalive_permit_without_calls': true,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': 10000,
      'grpc.http2.min_ping_interval_without_data_ms': 5 * 60 * 1000,
      'grpc.max_receive_message_length': config.GRPC_MAX_RECEIVE_MESSAGE_LENGTH,
      'grpc.max_send_message_length': config.GRPC_MAX_SEND_MESSAGE_LENGTH,
    }
  }
};

// Configuration validation and startup info
export const validateConfiguration = (): void => {
  console.log('🔧 Configuration validated successfully');
  
  if (config.NODE_ENV === 'development') {
    console.log('📋 Configuration summary:');
    console.log(`  Service: ${config.SERVICE_NAME}@${config.SERVICE_VERSION}`);
    console.log(`  HTTP: ${derivedConfig.httpUrl}`);
    console.log(`  gRPC: ${derivedConfig.grpcUrl}`);
    console.log(`  Environment: ${config.NODE_ENV}`);
    console.log(`  Log Level: ${config.LOG_LEVEL}`);
    console.log(`  RabbitMQ: ${config.RABBITMQ_URL}`);
  }
};

export type Config = typeof config;
export type DerivedConfig = typeof derivedConfig;
