export interface Product {
    id: string;
    name: string;
    description: string;
    sku: string;
    category: string;
    price: number;
    currency: string;
    stockQuantity: number;
    minStockLevel: number;
    maxStockLevel: number;
    isActive: boolean;
    images: string[];
    tags: string[];
    attributes: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    correlationId?: string;
}
export interface CreateProductRequest {
    name: string;
    description: string;
    sku: string;
    category: string;
    price: number;
    currency: string;
    stockQuantity: number;
    minStockLevel: number;
    maxStockLevel: number;
    images?: string[];
    tags?: string[];
    attributes?: Record<string, any>;
}
export interface UpdateProductRequest {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    currency?: string;
    stockQuantity?: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    isActive?: boolean;
    images?: string[];
    tags?: string[];
    attributes?: Record<string, any>;
}
export interface ProductFilters {
    category?: string;
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
}
export interface ProductMetrics {
    totalProducts: number;
    activeProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    averagePrice: number;
    totalValue: number;
    productsByCategory: Record<string, number>;
    stockLevels: Array<{
        productId: string;
        productName: string;
        currentStock: number;
        minStock: number;
        maxStock: number;
    }>;
}
export interface StockUpdate {
    productId: string;
    quantity: number;
    operation: 'add' | 'subtract' | 'set';
    reason: string;
    correlationId?: string;
}
export interface ProductCreatedEvent {
    type: 'product.created';
    productId: string;
    name: string;
    sku: string;
    category: string;
    price: number;
    stockQuantity: number;
    timestamp: Date;
    correlationId: string;
}
export interface ProductUpdatedEvent {
    type: 'product.updated';
    productId: string;
    name: string;
    sku: string;
    changes: Record<string, any>;
    timestamp: Date;
    correlationId: string;
}
export interface StockUpdatedEvent {
    type: 'stock.updated';
    productId: string;
    productName: string;
    oldQuantity: number;
    newQuantity: number;
    operation: string;
    reason: string;
    timestamp: Date;
    correlationId: string;
}
export interface ProductDeactivatedEvent {
    type: 'product.deactivated';
    productId: string;
    name: string;
    sku: string;
    reason: string;
    timestamp: Date;
    correlationId: string;
}
export type ProductEvent = ProductCreatedEvent | ProductUpdatedEvent | StockUpdatedEvent | ProductDeactivatedEvent;
//# sourceMappingURL=product.d.ts.map