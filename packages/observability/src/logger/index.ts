// Main exports for @observability-hub/log-client

export { ObservabilityLogger } from './logger';
export * from './types';

// Convenience re-exports
export type {
  LogClientConfig,
  LogLevel,
  LogMessage,
  LogContext,
  BusinessEvent,
  SecurityEvent,
  PublishResult,
  BatchPublishResult,
  ClientMetrics,
} from './types';

// Default export
export { ObservabilityLogger as default } from './logger'; 