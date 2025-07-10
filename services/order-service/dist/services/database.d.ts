import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
export declare class DatabaseService {
    private pool;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    initializeSchema(): Promise<void>;
    disconnect(): Promise<void>;
    getConnectionStatus(): boolean;
    getAllOrders(filters?: OrderFilters): Promise<{
        orders: Order[];
        total: number;
    }>;
    getOrderById(id: string): Promise<Order | null>;
    createOrder(orderData: CreateOrderRequest): Promise<Order>;
    updateOrder(id: string, updates: UpdateOrderRequest): Promise<Order | null>;
    deleteOrder(id: string): Promise<boolean>;
    private getOrderItems;
    private getOrderAddresses;
}
export declare const db: DatabaseService;
//# sourceMappingURL=database.d.ts.map