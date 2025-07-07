"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const log_client_1 = require("@observability-hub/log-client");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const logger = new log_client_1.ObservabilityLogger({
    serviceName: 'order-service',
    serviceVersion: '1.0.0',
    environment: 'development',
    rabbitmqUrl: 'amqp://localhost:5672',
    rabbitmqVhost: '/',
    rabbitmqExchange: 'logs',
    defaultLogLevel: 'INFO',
});
const orders = new Map();
router.get('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    logger.info('Fetching orders', { correlationId });
    res.json({ orders: Array.from(orders.values()), correlationId });
});
router.get('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderId = req.params.id;
    logger.info('Fetching order by ID', { orderId, correlationId });
    const order = orders.get(orderId);
    if (!order) {
        res.status(404).json({ error: 'Order not found', orderId, correlationId });
        return;
    }
    res.json({ order, correlationId });
});
router.post('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderData = req.body;
    logger.info('Creating new order', { orderData, correlationId });
    const orderId = (0, uuid_1.v4)();
    const now = new Date();
    const order = {
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
router.put('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderId = req.params.id;
    const updateData = req.body;
    logger.info('Updating order', { orderId, updateData, correlationId });
    const existingOrder = orders.get(orderId);
    if (!existingOrder) {
        res.status(404).json({ error: 'Order not found', orderId, correlationId });
        return;
    }
    const updatedOrder = {
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
router.delete('/:id', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
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
exports.default = router;
//# sourceMappingURL=orders.js.map