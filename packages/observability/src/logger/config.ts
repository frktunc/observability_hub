import { LogClientConfig, LogLevel } from './types';

export type FullLogClientConfig = Required<Omit<LogClientConfig, 'rabbitmqUsername' | 'rabbitmqPassword' | 'rabbitmqUrl'>> & {
  rabbitmqUrl?: string;
  rabbitmqUsername?: string;
  rabbitmqPassword?: string;
};

export function createDefaultConfig(config: LogClientConfig): FullLogClientConfig {
  return {
    ...config,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion || '1.0.0',
    environment: config.environment || 'development',
    rabbitmqHostname: config.rabbitmqHostname || 'obs_rabbitmq',
    rabbitmqPort: config.rabbitmqPort || 5672,
    rabbitmqVhost: config.rabbitmqVhost || '/',
    rabbitmqExchange: config.rabbitmqExchange || 'logs.topic',
    connectionTimeout: config.connectionTimeout || 30000,
    heartbeat: config.heartbeat || 60,
    maxRetries: config.maxRetries || 5,
    retryDelayMs: config.retryDelayMs || 2000,
    defaultLogLevel: config.defaultLogLevel || LogLevel.INFO,
    enableBatching: config.enableBatching || false,
    batchSize: config.batchSize || 100,
    batchTimeoutMs: config.batchTimeoutMs || 5000,
    enableCircuitBreaker: config.enableCircuitBreaker || true,
    circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
    circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
  };
}
