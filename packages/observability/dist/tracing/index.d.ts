import { NodeSDK } from '@opentelemetry/sdk-node';
interface TracerConfig {
    serviceName: string;
    serviceVersion: string;
    environment: string;
    jaegerEndpoint: string;
    jaegerEnabled: boolean;
}
export declare function initTracer(config: TracerConfig): void;
export declare function getSdk(): NodeSDK | null;
export {};
//# sourceMappingURL=index.d.ts.map