import { LogMessage, PublishOptions, PublishResult } from './types';
import { RabbitMQConnection } from './connection';
import { CircuitBreaker } from './circuit-breaker';
import { FullLogClientConfig } from './config';
export declare function createPublisher(config: FullLogClientConfig, connection: RabbitMQConnection, circuitBreaker: CircuitBreaker): {
    publishMessage: (message: LogMessage, options?: PublishOptions) => Promise<PublishResult>;
};
//# sourceMappingURL=publisher.d.ts.map