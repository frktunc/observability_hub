"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../services/database");
const router = (0, express_1.Router)();
const logger = {
    info: (message, metadata) => console.log(`[INFO] ${message}`, metadata || ''),
    warn: (message, metadata) => console.warn(`[WARN] ${message}`, metadata || ''),
    error: (message, metadata) => console.error(`[ERROR] ${message}`, metadata || ''),
    debug: (message, metadata) => console.debug(`[DEBUG] ${message}`, metadata || '')
};
router.get('/', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const filters = {
            category: req.query.category,
            min_price: req.query.min_price ? parseFloat(req.query.min_price) : undefined,
            max_price: req.query.max_price ? parseFloat(req.query.max_price) : undefined,
            is_active: req.query.is_active ? req.query.is_active === 'true' : true,
            search: req.query.search
        };
        const pagination = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };
        logger.info('Fetching products', { filters, pagination, correlationId });
        const result = await database_1.db.getAllProducts(filters, pagination);
        res.json({
            products: result.products,
            total: result.total,
            limit: pagination.limit,
            offset: pagination.offset,
            correlationId
        });
    }
    catch (error) {
        logger.error('Error fetching products:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch products',
            correlationId
        });
    }
});
router.get('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    try {
        logger.info('Fetching product by ID', { productId, correlationId });
        const product = await database_1.db.getProductById(productId);
        if (!product) {
            res.status(404).json({
                error: 'Product not found',
                productId,
                correlationId
            });
            return;
        }
        res.json({ product, correlationId });
    }
    catch (error) {
        logger.error('Error fetching product by ID:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch product',
            correlationId
        });
    }
});
router.get('/sku/:sku', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const sku = req.params.sku;
    try {
        logger.info('Fetching product by SKU', { sku, correlationId });
        const product = await database_1.db.getProductBySku(sku);
        if (!product) {
            res.status(404).json({
                error: 'Product not found',
                sku,
                correlationId
            });
            return;
        }
        res.json({ product, correlationId });
    }
    catch (error) {
        logger.error('Error fetching product by SKU:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch product',
            correlationId
        });
    }
});
router.post('/', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const productData = req.body;
        logger.info('Creating new product', { productData, correlationId });
        const product = await database_1.db.createProduct(productData);
        logger.info('Product created', {
            eventType: 'product.created',
            productId: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            price: product.price,
            stock_quantity: product.stock_quantity,
            timestamp: new Date(),
            correlationId
        });
        res.status(201).json({ product, correlationId });
    }
    catch (error) {
        logger.error('Error creating product:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create product',
            correlationId
        });
    }
});
router.put('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    try {
        const updateData = req.body;
        logger.info('Updating product', { productId, updateData, correlationId });
        const product = await database_1.db.updateProduct(productId, updateData);
        if (!product) {
            res.status(404).json({
                error: 'Product not found',
                productId,
                correlationId
            });
            return;
        }
        logger.info('Product updated', {
            eventType: 'product.updated',
            productId,
            name: product.name,
            sku: product.sku,
            changes: updateData,
            timestamp: new Date(),
            correlationId
        });
        res.json({ product, correlationId });
    }
    catch (error) {
        logger.error('Error updating product:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to update product',
            correlationId
        });
    }
});
router.delete('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const productId = req.params.id;
    try {
        logger.info('Deleting product', { productId, correlationId });
        const success = await database_1.db.deleteProduct(productId);
        if (!success) {
            res.status(404).json({
                error: 'Product not found',
                productId,
                correlationId
            });
            return;
        }
        logger.info('Product deleted', {
            eventType: 'product.deleted',
            productId,
            timestamp: new Date(),
            correlationId
        });
        res.json({
            message: 'Product deleted successfully',
            productId,
            correlationId
        });
    }
    catch (error) {
        logger.error('Error deleting product:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to delete product',
            correlationId
        });
    }
});
router.get('/stats', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        logger.info('Fetching product statistics', { correlationId });
        const stats = await database_1.db.getProductStats();
        res.json({
            stats,
            correlationId
        });
    }
    catch (error) {
        logger.error('Error fetching product stats:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch product statistics',
            correlationId
        });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map