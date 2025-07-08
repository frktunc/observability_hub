import { Router, Request, Response } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { Order, CreateOrderRequest, UpdateOrderRequest } from '../types/order';
import { v4 as uuidv4 } from 'uuid';
import { config, derivedConfig } from '../config';

const router = Router();
const logger = new ObservabilityLogger({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqHostname: derivedConfig.rabbitmq.hostname,
  rabbitmqPort: derivedConfig.rabbitmq.port,
  rabbitmqUsername: derivedConfig.rabbitmq.user,
  rabbitmqPassword: derivedConfig.rabbitmq.password,
  rabbitmqVhost: derivedConfig.rabbitmq.vhost,
  rabbitmqExchange: derivedConfig.rabbitmq.exchange,
  defaultLogLevel: config.LOG_LEVEL as any,
});

const orders: Map<string, Order> = new Map();

router.get('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  logger.info('Fetching orders', { correlationId });
  res.json({ orders: Array.from(orders.values()), correlationId });
});

router.get('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  logger.info('Fetching order by ID', { orderId, correlationId });
  const order = orders.get(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found', orderId, correlationId });
    return;
  }
  res.json({ order, correlationId });
});

router.post('/', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderData: CreateOrderRequest = req.body;
  logger.info('Creating new order', { orderData, correlationId });
  const orderId = uuidv4();
  const now = new Date();
  const order: Order = {
    id: orderId,
    userId: orderData.userId,
    items: orderData.items,
    status: 'pending',
    totalAmount: orderData.totalAmount,
    currency: orderData.currency,
    shippingAddress: orderData.shippingAddress,
    billingAddress: orderData.billingAddress,
    paymentMethod: orderData.paymentMethod,
    createdAt: now,
    updatedAt: now,
    correlationId
  };
  orders.set(orderId, order);
  logger.info('Order created', {
    eventType: 'order.created',
    orderId,
    userId: order.userId,
    totalAmount: order.totalAmount,
    status: order.status,
    timestamp: now,
    correlationId
  });
  res.status(201).json({ order, correlationId });
});

router.put('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  const updateData: UpdateOrderRequest = req.body;
  logger.info('Updating order', { orderId, updateData, correlationId });
  const existingOrder = orders.get(orderId);
  if (!existingOrder) {
    res.status(404).json({ error: 'Order not found', orderId, correlationId });
    return;
  }
  const updatedOrder: Order = {
    ...existingOrder,
    ...updateData,
    updatedAt: new Date(),
    correlationId
  };
  orders.set(orderId, updatedOrder);
  logger.info('Order updated', {
    eventType: 'order.updated',
    orderId,
    changes: updateData,
    timestamp: new Date(),
    correlationId
  });
  res.json({ order: updatedOrder, correlationId });
});

router.delete('/:id', (req: Request, res: Response): void => {
  const correlationId = (req as any).correlationId || 'unknown';
  const orderId = req.params.id;
  logger.info('Deleting order', { orderId, correlationId });
  const order = orders.get(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found', orderId, correlationId });
    return;
  }
  orders.delete(orderId);
  logger.info('Order deleted', {
    eventType: 'order.deleted',
    orderId,
    timestamp: new Date(),
    correlationId
  });
  res.json({ success: true, orderId, correlationId });
});

export default router; 