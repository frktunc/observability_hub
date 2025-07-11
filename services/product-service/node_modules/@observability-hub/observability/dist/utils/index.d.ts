export declare const createCircuitBreakerConfig: (options?: {
    enabled?: boolean;
    timeout?: number;
    errorThreshold?: number;
    resetTimeout?: number;
}) => {
    enabled: boolean;
    timeout: number;
    errorThreshold: number;
    resetTimeout: number;
};
export declare const createMonitoringSetup: (serviceName: string) => {
    serviceName: string;
    metricsEnabled: boolean;
    healthCheckEnabled: boolean;
    tracingEnabled: boolean;
};
export declare const createObservabilityFactory: (serviceName: string) => {
    serviceName: string;
    defaultPorts: {
        api: number;
        metrics: number;
    };
};
//# sourceMappingURL=index.d.ts.map