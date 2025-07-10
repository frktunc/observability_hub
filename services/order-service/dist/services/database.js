"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.DatabaseService = void 0;
const pg_1 = require("pg");
const config_1 = require("../config");
const uuid_1 = require("uuid");
class DatabaseService {
    pool;
    isConnected = false;
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: config_1.derivedConfig.database.url,
            host: config_1.derivedConfig.database.host,
            port: config_1.derivedConfig.database.port,
            database: config_1.derivedConfig.database.name,
            user: config_1.derivedConfig.database.user,
            password: config_1.derivedConfig.database.password,
            min: config_1.derivedConfig.database.pool.min,
            max: config_1.derivedConfig.database.pool.max,
            connectionTimeoutMillis: config_1.derivedConfig.database.timeout,
            idleTimeoutMillis: 30000,
            allowExitOnIdle: false,
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.pool.on('connect', (client) => {
            console.log('Database client connected');
            this.isConnected = true;
        });
        this.pool.on('error', (err) => {
            console.error('Database pool error:', err);
            this.isConnected = false;
        });
        this.pool.on('remove', () => {
            console.log('Database client removed from pool');
        });
    }
    async connect() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            console.log('✅ Database connected successfully');
            this.isConnected = true;
            await this.initializeSchema();
        }
        catch (error) {
            console.error('❌ Database connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }
    async initializeSchema() {
        const client = await this.pool.connect();
        try {
            const createOrdersTable = `
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          total_amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'USD',
          payment_method VARCHAR(100),
          notes TEXT,
          correlation_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id VARCHAR(255) NOT NULL,
          quantity INTEGER NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS addresses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL, -- 'shipping' or 'billing'
          street VARCHAR(255) NOT NULL,
          city VARCHAR(100) NOT NULL,
          state VARCHAR(100) NOT NULL,
          postal_code VARCHAR(20) NOT NULL,
          country VARCHAR(100) NOT NULL,
          zip_code VARCHAR(20),
          phone VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create updated_at trigger function
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Drop existing triggers and create new ones
        DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
        CREATE TRIGGER update_orders_updated_at
          BEFORE UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_correlation_id ON orders(correlation_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_addresses_order_id ON addresses(order_id);
        CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(type);
      `;
            await client.query(createOrdersTable);
            console.log('✅ Orders database schema initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize orders database schema:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async disconnect() {
        try {
            await this.pool.end();
            console.log('Database disconnected');
            this.isConnected = false;
        }
        catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
    getConnectionStatus() {
        return this.isConnected;
    }
    async getAllOrders(filters = {}) {
        const { userId, status, startDate, endDate, limit = 50, offset = 0 } = filters;
        let whereClause = 'WHERE 1=1';
        const queryParams = [];
        let paramIndex = 1;
        if (userId) {
            whereClause += ` AND user_id = $${paramIndex}`;
            queryParams.push(userId);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }
        if (startDate) {
            whereClause += ` AND created_at >= $${paramIndex}`;
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            whereClause += ` AND created_at <= $${paramIndex}`;
            queryParams.push(endDate);
            paramIndex++;
        }
        const countQuery = `SELECT COUNT(*) FROM orders ${whereClause}`;
        const dataQuery = `
      SELECT * FROM orders 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        queryParams.push(limit, offset);
        try {
            const [countResult, dataResult] = await Promise.all([
                this.pool.query(countQuery, queryParams.slice(0, -2)),
                this.pool.query(dataQuery, queryParams)
            ]);
            const ordersWithDetails = await Promise.all(dataResult.rows.map(async (order) => {
                const [items, addresses] = await Promise.all([
                    this.getOrderItems(order.id),
                    this.getOrderAddresses(order.id)
                ]);
                const shippingAddress = addresses.find(addr => addr.type === 'shipping');
                const billingAddress = addresses.find(addr => addr.type === 'billing');
                return {
                    ...order,
                    items,
                    shippingAddress,
                    billingAddress,
                    createdAt: order.created_at,
                    updatedAt: order.updated_at,
                    userId: order.user_id,
                    totalAmount: parseFloat(order.total_amount),
                    paymentMethod: order.payment_method,
                    correlationId: order.correlation_id
                };
            }));
            return {
                orders: ordersWithDetails,
                total: parseInt(countResult.rows[0].count)
            };
        }
        catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    }
    async getOrderById(id) {
        try {
            const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return null;
            }
            const order = result.rows[0];
            const [items, addresses] = await Promise.all([
                this.getOrderItems(order.id),
                this.getOrderAddresses(order.id)
            ]);
            const shippingAddress = addresses.find(addr => addr.type === 'shipping');
            const billingAddress = addresses.find(addr => addr.type === 'billing');
            return {
                ...order,
                items,
                shippingAddress,
                billingAddress,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                userId: order.user_id,
                totalAmount: parseFloat(order.total_amount),
                paymentMethod: order.payment_method,
                correlationId: order.correlation_id
            };
        }
        catch (error) {
            console.error('Error fetching order by ID:', error);
            throw error;
        }
    }
    async createOrder(orderData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const orderId = (0, uuid_1.v4)();
            const orderResult = await client.query(`
        INSERT INTO orders (id, user_id, total_amount, currency, payment_method)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [orderId, orderData.userId, orderData.totalAmount, orderData.currency, orderData.paymentMethod]);
            const order = orderResult.rows[0];
            for (const item of orderData.items) {
                await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [orderId, item.productId, item.quantity, item.price]);
            }
            await client.query(`
        INSERT INTO addresses (order_id, type, street, city, state, postal_code, country, zip_code, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [orderId, 'shipping', orderData.shippingAddress.street, orderData.shippingAddress.city,
                orderData.shippingAddress.state, orderData.shippingAddress.postalCode,
                orderData.shippingAddress.country, orderData.shippingAddress.zipCode,
                orderData.shippingAddress.phone]);
            await client.query(`
        INSERT INTO addresses (order_id, type, street, city, state, postal_code, country, zip_code, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [orderId, 'billing', orderData.billingAddress.street, orderData.billingAddress.city,
                orderData.billingAddress.state, orderData.billingAddress.postalCode,
                orderData.billingAddress.country, orderData.billingAddress.zipCode,
                orderData.billingAddress.phone]);
            await client.query('COMMIT');
            return await this.getOrderById(orderId);
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('Error creating order:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async updateOrder(id, updates) {
        try {
            const setClause = [];
            const queryParams = [];
            let paramIndex = 1;
            if (updates.status !== undefined) {
                setClause.push(`status = $${paramIndex}`);
                queryParams.push(updates.status);
                paramIndex++;
            }
            if (updates.totalAmount !== undefined) {
                setClause.push(`total_amount = $${paramIndex}`);
                queryParams.push(updates.totalAmount);
                paramIndex++;
            }
            if (updates.currency !== undefined) {
                setClause.push(`currency = $${paramIndex}`);
                queryParams.push(updates.currency);
                paramIndex++;
            }
            if (updates.paymentMethod !== undefined) {
                setClause.push(`payment_method = $${paramIndex}`);
                queryParams.push(updates.paymentMethod);
                paramIndex++;
            }
            if (setClause.length === 0) {
                return await this.getOrderById(id);
            }
            queryParams.push(id);
            const updateQuery = `
        UPDATE orders 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;
            const result = await this.pool.query(updateQuery, queryParams);
            if (result.rows.length === 0) {
                return null;
            }
            return await this.getOrderById(id);
        }
        catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    }
    async deleteOrder(id) {
        try {
            const result = await this.pool.query('DELETE FROM orders WHERE id = $1', [id]);
            return (result.rowCount ?? 0) > 0;
        }
        catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    }
    async getOrderItems(orderId) {
        try {
            const result = await this.pool.query('SELECT product_id, quantity, price FROM order_items WHERE order_id = $1', [orderId]);
            return result.rows.map(row => ({
                productId: row.product_id,
                quantity: row.quantity,
                price: parseFloat(row.price)
            }));
        }
        catch (error) {
            console.error('Error fetching order items:', error);
            throw error;
        }
    }
    async getOrderAddresses(orderId) {
        try {
            const result = await this.pool.query('SELECT * FROM addresses WHERE order_id = $1', [orderId]);
            return result.rows.map(row => ({
                type: row.type,
                street: row.street,
                city: row.city,
                state: row.state,
                postalCode: row.postal_code,
                country: row.country,
                zipCode: row.zip_code,
                phone: row.phone
            }));
        }
        catch (error) {
            console.error('Error fetching order addresses:', error);
            throw error;
        }
    }
}
exports.DatabaseService = DatabaseService;
exports.db = new DatabaseService();
//# sourceMappingURL=database.js.map