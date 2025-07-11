import { Router, Request, Response } from 'express';
import { ObservabilityLogger } from '@observability-hub/observability';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters, OrderStatus } from '../types/order';
import { config, derivedConfig } from '../config';
import { db } from '../services/database';

const router = Router();
const logger = new ObservabilityLogger({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqUrl: derivedConfig.rabbitmq.url,
  rabbitmqVhost: derivedConfig.rabbitmq.vhost,
  rabbitmqExchange: derivedConfig.rabbitmq.exchange,
  defaultLogLevel: config.LOG_LEVEL as any,
});

// GET /api/v1/orders - Fetch orders with filters and pagination
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    // Extract query parameters for filtering
    const filters: OrderFilters = {
      userId: req.query.userId as string,
      status: req.query.status ? req.query.status as OrderStatus : undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    logger.info('Fetching orders', { 
      filters, 
      correlationId,
      component: 'orders-api'
    });

    const result = await db.getAllOrders(filters);
    
    logger.info('Orders fetched successfully', {
      totalOrders: result.total,
      returnedOrders: result.orders.length,
      correlationId,
      component: 'orders-api'
    });

    res.json({
      orders: result.orders,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to fetch orders', errorObj, {
      correlationId,
      component: 'orders-api'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/orders/:id - Fetch order by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  
  try {
    logger.info('Fetching order by ID', { 
      orderId, 
      correlationId,
      component: 'orders-api'
    });

    const order = await db.getOrderById(orderId);
    
    if (!order) {
      logger.warn('Order not found', { 
        orderId, 
        correlationId,
        component: 'orders-api'
      });
      
      res.status(404).json({ 
        error: 'Order not found', 
        orderId, 
        correlationId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Order fetched successfully', {
      orderId,
      orderStatus: order.status,
      correlationId,
      component: 'orders-api'
    });

    res.json({ 
      order, 
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to fetch order by ID', errorObj, {
      orderId,
      correlationId,
      component: 'orders-api'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order',
      orderId,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/v1/orders - Create new order
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  
  try {
    const orderData: CreateOrderRequest = req.body;
    
    // Basic validation
    if (!orderData.userId || !orderData.items || orderData.items.length === 0) {
      res.status(400).json({
        error: 'Invalid order data',
        message: 'userId and items are required',
        correlationId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!orderData.shippingAddress || !orderData.billingAddress) {
      res.status(400).json({
        error: 'Invalid order data',
        message: 'shippingAddress and billingAddress are required',
        correlationId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Creating new order', { 
      userId: orderData.userId,
      itemsCount: orderData.items.length,
      totalAmount: orderData.totalAmount,
      correlationId,
      component: 'orders-api'
    });

    const order = await db.createOrder(orderData);
    
    logger.info('Order created successfully', {
      eventType: 'order.created',
      orderId: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      itemsCount: order.items.length,
      correlationId,
      component: 'orders-api',
      timestamp: order.createdAt
    });

    res.status(201).json({ 
      order, 
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to create order', errorObj, {
      correlationId,
      component: 'orders-api'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create order',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/v1/orders/:id - Update order
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  
  try {
    const updateData: UpdateOrderRequest = req.body;
    
    logger.info('Updating order', { 
      orderId, 
      updateFields: Object.keys(updateData),
      correlationId,
      component: 'orders-api'
    });

    const updatedOrder = await db.updateOrder(orderId, updateData);
    
    if (!updatedOrder) {
      logger.warn('Order not found for update', { 
        orderId, 
        correlationId,
        component: 'orders-api'
      });
      
      res.status(404).json({ 
        error: 'Order not found', 
        orderId, 
        correlationId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Order updated successfully', {
      eventType: 'order.updated',
      orderId,
      changes: updateData,
      newStatus: updatedOrder.status,
      correlationId,
      component: 'orders-api',
      timestamp: updatedOrder.updatedAt
    });

    res.json({ 
      order: updatedOrder, 
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to update order', errorObj, {
      orderId,
      correlationId,
      component: 'orders-api'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update order',
      orderId,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/v1/orders/:id - Delete order
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  
  try {
    logger.info('Deleting order', { 
      orderId, 
      correlationId,
      component: 'orders-api'
    });

    const deleted = await db.deleteOrder(orderId);
    
    if (!deleted) {
      logger.warn('Order not found for deletion', { 
        orderId, 
        correlationId,
        component: 'orders-api'
      });
      
      res.status(404).json({ 
        error: 'Order not found', 
        orderId, 
        correlationId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Order deleted successfully', {
      eventType: 'order.deleted',
      orderId,
      correlationId,
      component: 'orders-api',
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      orderId, 
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Failed to delete order', errorObj, {
      orderId,
      correlationId,
      component: 'orders-api'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete order',
      orderId,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 