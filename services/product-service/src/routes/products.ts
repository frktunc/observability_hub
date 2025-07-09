import { Router, Request, Response } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { db, Product, CreateProductRequest, UpdateProductRequest, ProductFilters } from '../services/database';
import { config } from '../config';

const router = Router();

// Initialize logger
const logger = new ObservabilityLogger({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqUrl: 'amqp://obs_user:obs_password@obs_rabbitmq:5672/',
  rabbitmqVhost: '/',
  rabbitmqExchange: 'logs.topic',
  defaultLogLevel: config.LOG_LEVEL as any,
});

// GET /api/v1/products - List all products
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    // Parse query parameters
    const filters: ProductFilters = {
      category: req.query.category as string,
      min_price: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
      max_price: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
      is_active: req.query.is_active ? req.query.is_active === 'true' : true,
      search: req.query.search as string
    };
    
    const pagination = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };
    
    logger.info('Fetching products', { filters, pagination, correlationId });
    
    const result = await db.getAllProducts(filters, pagination);
    
    res.json({
      products: result.products,
      total: result.total,
      limit: pagination.limit,
      offset: pagination.offset,
      correlationId
    });
  } catch (error) {
    logger.error('Error fetching products:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch products',
      correlationId
    });
  }
});

// GET /api/v1/products/:id - Get product by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const productId = req.params.id;
  
  try {
    logger.info('Fetching product by ID', { productId, correlationId });
    
    const product = await db.getProductById(productId);
    
    if (!product) {
      res.status(404).json({
        error: 'Product not found',
        productId,
        correlationId
      });
      return;
    }
    
    res.json({ product, correlationId });
  } catch (error) {
    logger.error('Error fetching product by ID:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch product',
      correlationId
    });
  }
});

// GET /api/v1/products/sku/:sku - Get product by SKU
router.get('/sku/:sku', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const sku = req.params.sku;
  
  try {
    logger.info('Fetching product by SKU', { sku, correlationId });
    
    const product = await db.getProductBySku(sku);
    
    if (!product) {
      res.status(404).json({
        error: 'Product not found',
        sku,
        correlationId
      });
      return;
    }
    
    res.json({ product, correlationId });
  } catch (error) {
    logger.error('Error fetching product by SKU:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch product',
      correlationId
    });
  }
});

// POST /api/v1/products - Create new product
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    const productData: CreateProductRequest = req.body;
    
    logger.info('Creating new product', { productData, correlationId });
    
    const product = await db.createProduct(productData);
    
    // Log business event
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
  } catch (error) {
    logger.error('Error creating product:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create product',
      correlationId
    });
  }
});

// PUT /api/v1/products/:id - Update product
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const productId = req.params.id;
  
  try {
    const updateData: UpdateProductRequest = req.body;
    
    logger.info('Updating product', { productId, updateData, correlationId });
    
    const product = await db.updateProduct(productId, updateData);
    
    if (!product) {
      res.status(404).json({
        error: 'Product not found',
        productId,
        correlationId
      });
      return;
    }
    
    // Log business event
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
  } catch (error) {
    logger.error('Error updating product:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product',
      correlationId
    });
  }
});

// DELETE /api/v1/products/:id - Soft delete product
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const productId = req.params.id;
  
  try {
    logger.info('Deleting product', { productId, correlationId });
    
    const success = await db.deleteProduct(productId);
    
    if (!success) {
      res.status(404).json({
        error: 'Product not found',
        productId,
        correlationId
      });
      return;
    }
    
    // Log business event
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
  } catch (error) {
    logger.error('Error deleting product:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete product',
      correlationId
    });
  }
});

// GET /api/v1/products/stats - Get product statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    logger.info('Fetching product statistics', { correlationId });
    
    const stats = await db.getProductStats();
    
    res.json({
      stats,
      correlationId
    });
  } catch (error) {
    logger.error('Error fetching product stats:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch product statistics',
      correlationId
    });
  }
});

export default router; 