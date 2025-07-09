import { Router, Request, Response } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { 
  Product, 
  CreateProductRequest, 
  UpdateProductRequest, 
  ProductFilters,
  ProductCreatedEvent,
  ProductUpdatedEvent,
  StockUpdatedEvent,
  ProductDeactivatedEvent
} from '../types/product';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize logger
const logger = new ObservabilityLogger({
  serviceName: 'product-service',
  serviceVersion: '1.0.0',
  environment: 'development',
  rabbitmqUrl: 'amqp://obs_user:obs_password@obs_rabbitmq:5672/',
  rabbitmqVhost: '/',
  rabbitmqExchange: 'logs',
  defaultLogLevel: 'INFO' as any,
});

// In-memory storage for demo
const products: Map<string, Product> = new Map();

// GET /api/v1/products - List all products
router.get('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const filters: ProductFilters = req.query as any;
  
  logger.info('Fetching products', { filters, correlationId });
  
  let filteredProducts = Array.from(products.values());
  
  // Apply filters
  if (filters.category) {
    filteredProducts = filteredProducts.filter(p => p.category === filters.category);
  }
  
  if (filters.isActive !== undefined) {
    filteredProducts = filteredProducts.filter(p => p.isActive === filters.isActive);
  }
  
  if (filters.minPrice) {
    filteredProducts = filteredProducts.filter(p => p.price >= filters.minPrice!);
  }
  
  if (filters.maxPrice) {
    filteredProducts = filteredProducts.filter(p => p.price <= filters.maxPrice!);
  }
  
  if (filters.inStock) {
    filteredProducts = filteredProducts.filter(p => p.stockQuantity > 0);
  }
  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm)
    );
  }
  
  // Pagination
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

// GET /api/v1/products/:id - Get product by ID
router.get('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
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

// POST /api/v1/products - Create new product
router.post('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const productData: CreateProductRequest = req.body;
  
  logger.info('Creating new product', { productData, correlationId });
  
  const productId = uuidv4();
  const now = new Date();
  
  const product: Product = {
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
  
  // Log business event
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

// PUT /api/v1/products/:id - Update product
router.put('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const productId = req.params.id;
  const updateData: UpdateProductRequest = req.body;
  
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
  
  const updatedProduct: Product = {
    ...existingProduct,
    ...updateData,
    updatedAt: new Date(),
    correlationId
  };
  
  products.set(productId, updatedProduct);
  
  // Log business event
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

// PATCH /api/v1/products/:id/stock - Update stock
router.patch('/:id/stock', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
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
  
  const updatedProduct: Product = {
    ...product,
    stockQuantity: newQuantity,
    updatedAt: new Date(),
    correlationId
  };
  
  products.set(productId, updatedProduct);
  
  // Log business event
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

// DELETE /api/v1/products/:id - Deactivate product
router.delete('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
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
  
  const updatedProduct: Product = {
    ...product,
    isActive: false,
    updatedAt: new Date(),
    correlationId
  };
  
  products.set(productId, updatedProduct);
  
  // Log business event
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

export default router; 