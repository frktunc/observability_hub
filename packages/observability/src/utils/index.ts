// Utility functions for observability setup

export const createCircuitBreakerConfig = (options: {
  enabled?: boolean;
  timeout?: number;
  errorThreshold?: number;
  resetTimeout?: number;
} = {}) => ({
  enabled: options.enabled ?? true,
  timeout: options.timeout ?? 3000,
  errorThreshold: options.errorThreshold ?? 50,
  resetTimeout: options.resetTimeout ?? 30000,
});

export const createMonitoringSetup = (serviceName: string) => ({
  serviceName,
  metricsEnabled: true,
  healthCheckEnabled: true,
  tracingEnabled: true,
});

export const createObservabilityFactory = (serviceName: string) => ({
  serviceName,
  defaultPorts: {
    api: 8080,
    metrics: 9090,
  },
}); 