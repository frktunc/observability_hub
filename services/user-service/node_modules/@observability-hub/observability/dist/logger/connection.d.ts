import { FullLogClientConfig } from './config';
export interface RabbitMQConnection {
    connection: any | null;
    channel: any | null;
    isConnected: boolean;
    connect(): Promise<void>;
    close(): Promise<void>;
}
export declare function createRabbitMQConnection(config: FullLogClientConfig, onReconnect: () => void): RabbitMQConnection;
//# sourceMappingURL=connection.d.ts.map