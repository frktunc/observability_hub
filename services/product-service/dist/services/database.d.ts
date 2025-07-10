export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    sku: string;
    stock_quantity: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    created_by?: string;
    updated_by?: string;
}
export interface CreateProductRequest {
    name: string;
    description?: string;
    price: number;
    category: string;
    sku: string;
    stock_quantity?: number;
}
export interface UpdateProductRequest {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    sku?: string;
    stock_quantity?: number;
    is_active?: boolean;
}
export interface ProductFilters {
    category?: string;
    min_price?: number;
    max_price?: number;
    is_active?: boolean;
    search?: string;
}
export interface PaginationOptions {
    limit?: number;
    offset?: number;
}
declare class DatabaseService {
    private pool;
    private isConnected;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getConnectionStatus(): boolean;
    getAllProducts(filters?: ProductFilters, pagination?: PaginationOptions): Promise<{
        products: Product[];
        total: number;
    }>;
    getProductById(id: string): Promise<Product | null>;
    getProductBySku(sku: string): Promise<Product | null>;
    createProduct(productData: CreateProductRequest): Promise<Product>;
    updateProduct(id: string, updates: UpdateProductRequest): Promise<Product | null>;
    deleteProduct(id: string): Promise<boolean>;
    getProductStats(): Promise<{
        total_products: number;
        total_categories: number;
        total_stock_value: number;
        low_stock_products: number;
    }>;
}
export declare const db: DatabaseService;
export default db;
//# sourceMappingURL=database.d.ts.map