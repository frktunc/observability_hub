"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_client_1 = require("@observability-hub/log-client");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const logger = new log_client_1.ObservabilityLogger({
    serviceName: 'product-service',
    serviceVersion: '1.0.0',
    environment: 'development',
    rabbitmqUrl: 'amqp://localhost:5672',
    rabbitmqVhost: '/',
    rabbitmqExchange: 'logs',
    defaultLogLevel: 'INFO',
});
const products = new Map();
router.get('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const filters = req.query;
    logger.info('Fetching products', { filters, correlationId });
    let filteredProducts = Array.from(products.values());
    if (filters.category) {
        filteredProducts = filteredProducts.filter(p => p.category === filters.category);
    }
    if (filters.isActive !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.isActive === filters.isActive);
    }
    if (filters.minPrice) {
        filteredProducts = filteredProducts.filter(p => p.price >= filters.minPrice);
    }
    if (filters.maxPrice) {
        filteredProducts = filteredProducts.filter(p => p.price <= filters.maxPrice);
    }
    if (filters.inStock) {
        filteredProducts = filteredProducts.filter(p => p.stockQuantity > 0);
    }
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm));
    }
    const limit = filters.limit ? parseInt(filters.limit.toString()) : 50;
    const offset = filters.offset ? parseInt(filters.offset.toString()) : 0;
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);
    res.json({
        products: paginatedProducts,
        total: filteredProducts.length,
        limit,
        offset,
        correlationId
    });
});
router.get('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    logger.info('Fetching product by ID', { productId, correlationId });
    const product = products.get(productId);
    if (!product) {
        res.status(404).json({
            error: 'Product not found',
            productId,
            correlationId
        });
        return;
    }
    res.json({ product, correlationId });
});
router.post('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productData = req.body;
    logger.info('Creating new product', { productData, correlationId });
    const productId = (0, uuid_1.v4)();
    const now = new Date();
    const product = {
        id: productId,
        name: productData.name,
        description: productData.description,
        sku: productData.sku,
        category: productData.category,
        price: productData.price,
        currency: productData.currency,
        stockQuantity: productData.stockQuantity,
        minStockLevel: productData.minStockLevel,
        maxStockLevel: productData.maxStockLevel,
        isActive: true,
        images: productData.images || [],
        tags: productData.tags || [],
        attributes: productData.attributes || {},
        createdAt: now,
        updatedAt: now,
        correlationId
    };
    products.set(productId, product);
    logger.info('Product created', {
        eventType: 'product.created',
        productId,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        stockQuantity: product.stockQuantity,
        timestamp: now,
        correlationId
    });
    res.status(201).json({ product, correlationId });
});
router.put('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    const updateData = req.body;
    logger.info('Updating product', { productId, updateData, correlationId });
    const existingProduct = products.get(productId);
    if (!existingProduct) {
        res.status(404).json({
            error: 'Product not found',
            productId,
            correlationId
        });
        return;
    }
    const updatedProduct = {
        ...existingProduct,
        ...updateData,
        updatedAt: new Date(),
        correlationId
    };
    products.set(productId, updatedProduct);
    logger.info('Product updated', {
        eventType: 'product.updated',
        productId,
        name: updatedProduct.name,
        sku: updatedProduct.sku,
        changes: updateData,
        timestamp: new Date(),
        correlationId
    });
    res.json({ product: updatedProduct, correlationId });
});
router.patch('/:id/stock', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    const { quantity, operation, reason } = req.body;
    logger.info('Updating product stock', { productId, quantity, operation, reason, correlationId });
    const product = products.get(productId);
    if (!product) {
        res.status(404).json({
            error: 'Product not found',
            productId,
            correlationId
        });
        return;
    }
    const oldQuantity = product.stockQuantity;
    let newQuantity = oldQuantity;
    switch (operation) {
        case 'add':
            newQuantity = oldQuantity + quantity;
            break;
        case 'subtract':
            newQuantity = Math.max(0, oldQuantity - quantity);
            break;
        case 'set':
            newQuantity = quantity;
            break;
        default:
            res.status(400).json({
                error: 'Invalid operation',
                operation,
                correlationId
            });
            return;
    }
    const updatedProduct = {
        ...product,
        stockQuantity: newQuantity,
        updatedAt: new Date(),
        correlationId
    };
    products.set(productId, updatedProduct);
    logger.info('Stock updated', {
        eventType: 'stock.updated',
        productId,
        productName: product.name,
        oldQuantity,
        newQuantity,
        operation,
        reason,
        timestamp: new Date(),
        correlationId
    });
    res.json({ product: updatedProduct, correlationId });
});
router.delete('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    const { reason = 'Manual deactivation' } = req.body;
    logger.info('Deactivating product', { productId, reason, correlationId });
    const product = products.get(productId);
    if (!product) {
        res.status(404).json({
            error: 'Product not found',
            productId,
            correlationId
        });
        return;
    }
    const updatedProduct = {
        ...product,
        isActive: false,
        updatedAt: new Date(),
        correlationId
    };
    products.set(productId, updatedProduct);
    logger.info('Product deactivated', {
        eventType: 'product.deactivated',
        productId,
        name: product.name,
        sku: product.sku,
        reason,
        timestamp: new Date(),
        correlationId
    });
    res.json({ product: updatedProduct, correlationId });
});
exports.default = router;
//# sourceMappingURL=products.js.map