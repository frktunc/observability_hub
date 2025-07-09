export declare class DatabaseService {
    private pool;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    initializeSchema(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    getClient(): Promise<import("pg").PoolClient>;
    disconnect(): Promise<void>;
    getConnectionStatus(): boolean;
}
export declare const db: DatabaseService;
//# sourceMappingURL=database.d.ts.map