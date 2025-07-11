"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const observability_1 = require("@observability-hub/observability");
const config_1 = require("../config");
const database_1 = require("../services/database");
const router = (0, express_1.Router)();
const logger = new observability_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
router.get('/', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const filters = {
            userId: req.query.userId,
            status: req.query.status ? req.query.status : undefined,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0,
        };
        logger.info('Fetching orders', {
            filters,
            correlationId,
            component: 'orders-api'
        });
        const result = await database_1.db.getAllOrders(filters);
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
    }
    catch (error) {
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
router.get('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderId = req.params.id;
    try {
        logger.info('Fetching order by ID', {
            orderId,
            correlationId,
            component: 'orders-api'
        });
        const order = await database_1.db.getOrderById(orderId);
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
    }
    catch (error) {
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
router.post('/', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const orderData = req.body;
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
        const order = await database_1.db.createOrder(orderData);
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
    }
    catch (error) {
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
router.put('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderId = req.params.id;
    try {
        const updateData = req.body;
        logger.info('Updating order', {
            orderId,
            updateFields: Object.keys(updateData),
            correlationId,
            component: 'orders-api'
        });
        const updatedOrder = await database_1.db.updateOrder(orderId, updateData);
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
    }
    catch (error) {
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
router.delete('/:id', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    const orderId = req.params.id;
    try {
        logger.info('Deleting order', {
            orderId,
            correlationId,
            component: 'orders-api'
        });
        const deleted = await database_1.db.deleteOrder(orderId);
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
    }
    catch (error) {
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
exports.default = router;
//# sourceMappingURL=orders.js.map