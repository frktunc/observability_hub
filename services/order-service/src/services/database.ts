import { Pool, PoolClient, QueryResult } from 'pg';
import { ObservabilityLogger } from '@observability-hub/observability';
import { config, derivedConfig } from '../config';
import { Order, OrderItem, Address, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseService {
  private pool: Pool;
  private isConnected = false;
  private logger: ObservabilityLogger;

  constructor() {
    this.logger = new ObservabilityLogger({
      serviceName: config.SERVICE_NAME,
      serviceVersion: config.SERVICE_VERSION,
      environment: config.NODE_ENV,
      defaultLogLevel: config.LOG_LEVEL as any,
    });

    this.pool = new Pool({
      connectionString: derivedConfig.database.url,
      host: derivedConfig.database.host,
      port: derivedConfig.database.port,
      database: derivedConfig.database.name,
      user: derivedConfig.database.user,
      password: derivedConfig.database.password,
      min: derivedConfig.database.pool.min,
      max: derivedConfig.database.pool.max,
      connectionTimeoutMillis: derivedConfig.database.timeout,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.logger.info('Database client connected', { component: 'database' });
      this.isConnected = true;
    });

    this.pool.on('error', (err: Error) => {
      this.logger.error('Database pool error', err, { component: 'database' });
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      this.logger.debug('Database client removed from pool', { component: 'database' });
    });
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Initializing database connection', { component: 'database' });
      
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.logger.info('Database connected successfully', { component: 'database' });
      this.isConnected = true;
      
      // Initialize schema
      await this.initializeSchema();
    } catch (error) {
      this.logger.error('Database connection failed', error as Error, { component: 'database' });
      this.isConnected = false;
      throw error;
    }
  }

  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      this.logger.info('Initializing database schema', { component: 'database' });
      
      // Create orders table
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
      this.logger.info('Orders database schema initialized', { component: 'database' });
    } catch (error) {
      this.logger.error('Failed to initialize orders database schema', error as Error, { component: 'database' });
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from database', { component: 'database' });
      await this.pool.end();
      this.logger.info('Database disconnected', { component: 'database' });
      this.isConnected = false;
    } catch (error) {
      this.logger.error('Error disconnecting from database', error as Error, { component: 'database' });
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Order operations
  async getAllOrders(filters: OrderFilters = {}): Promise<{
    orders: Order[];
    total: number;
  }> {
    try {
      this.logger.debug('Fetching all orders', { 
        operation: 'getAllOrders',
        filters 
      });

      const { userId, status, startDate, endDate, limit = 50, offset = 0 } = filters;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
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

      const [countResult, dataResult] = await Promise.all([
        this.pool.query(countQuery, queryParams.slice(0, -2)),
        this.pool.query(dataQuery, queryParams)
      ]);

      // Get order items and addresses for each order
      const ordersWithDetails = await Promise.all(
        dataResult.rows.map(async (order) => {
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
        })
      );

      this.logger.info('Successfully fetched all orders', { 
        operation: 'getAllOrders',
        total: parseInt(countResult.rows[0].count),
        returned: ordersWithDetails.length
      });

      return {
        orders: ordersWithDetails,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      this.logger.error('Failed to fetch orders', error as Error, { operation: 'getAllOrders' });
      throw error;
    }
  }

  async getOrderById(id: string): Promise<Order | null> {
    try {
      this.logger.debug('Fetching order by ID', { operation: 'getOrderById', orderId: id });
      
      const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        this.logger.warn('Order not found by ID', { operation: 'getOrderById', orderId: id });
        return null;
      }

      const order = result.rows[0];
      const [items, addresses] = await Promise.all([
        this.getOrderItems(order.id),
        this.getOrderAddresses(order.id)
      ]);

      const shippingAddress = addresses.find(addr => addr.type === 'shipping');
      const billingAddress = addresses.find(addr => addr.type === 'billing');

      const orderWithDetails = {
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

      this.logger.info('Successfully fetched order by ID', { 
        operation: 'getOrderById', 
        orderId: id,
        status: orderWithDetails.status
      });

      return orderWithDetails;
    } catch (error) {
      this.logger.error('Failed to fetch order by ID', error as Error, { 
        operation: 'getOrderById', 
        orderId: id 
      });
      throw error;
    }
  }

  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const client = await this.pool.connect();
    try {
      this.logger.info('Creating new order', { 
        operation: 'createOrder',
        userId: orderData.userId,
        itemsCount: orderData.items.length,
        totalAmount: orderData.totalAmount
      });

      await client.query('BEGIN');

      const orderId = uuidv4();
      const correlationId = orderData.correlationId || uuidv4();

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (id, user_id, status, total_amount, currency, payment_method, notes, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          orderId,
          orderData.userId,
          orderData.status || 'pending',
          orderData.totalAmount,
          orderData.currency || 'USD',
          orderData.paymentMethod,
          orderData.notes,
          correlationId
        ]
      );

      // Create order items
      for (const item of orderData.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.productId, item.quantity, item.price]
        );
      }

      // Create addresses
      if (orderData.shippingAddress) {
        await client.query(
          `INSERT INTO addresses (order_id, type, street, city, state, postal_code, country, zip_code, phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderId, 'shipping',
            orderData.shippingAddress.street,
            orderData.shippingAddress.city,
            orderData.shippingAddress.state,
            orderData.shippingAddress.postalCode,
            orderData.shippingAddress.country,
            orderData.shippingAddress.zipCode,
            orderData.shippingAddress.phone
          ]
        );
      }

      if (orderData.billingAddress) {
        await client.query(
          `INSERT INTO addresses (order_id, type, street, city, state, postal_code, country, zip_code, phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderId, 'billing',
            orderData.billingAddress.street,
            orderData.billingAddress.city,
            orderData.billingAddress.state,
            orderData.billingAddress.postalCode,
            orderData.billingAddress.country,
            orderData.billingAddress.zipCode,
            orderData.billingAddress.phone
          ]
        );
      }

      await client.query('COMMIT');

      const order = orderResult.rows[0];
      const [items, addresses] = await Promise.all([
        this.getOrderItems(orderId),
        this.getOrderAddresses(orderId)
      ]);

      const shippingAddress = addresses.find(addr => addr.type === 'shipping');
      const billingAddress = addresses.find(addr => addr.type === 'billing');

      const newOrder = {
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

      this.logger.businessEvent({
        eventType: 'order.created',
        aggregateId: newOrder.id,
        aggregateType: 'Order',
        eventVersion: 1,
        correlationId: correlationId,
        timestamp: new Date().toISOString(),
        data: newOrder,
      });

      this.logger.info('Successfully created order', { 
        operation: 'createOrder',
        orderId: newOrder.id,
        userId: newOrder.userId,
        totalAmount: newOrder.totalAmount
      });

      return newOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create order', error as Error, { 
        operation: 'createOrder',
        userId: orderData.userId 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOrder(id: string, updates: UpdateOrderRequest): Promise<Order | null> {
    const client = await this.pool.connect();
    try {
      this.logger.info('Updating order', { 
        operation: 'updateOrder',
        orderId: id,
        updateFields: Object.keys(updates)
      });

      await client.query('BEGIN');

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updates.totalAmount !== undefined) {
        updateFields.push(`total_amount = $${paramIndex++}`);
        values.push(updates.totalAmount);
      }

      if (updates.paymentMethod !== undefined) {
        updateFields.push(`payment_method = $${paramIndex++}`);
        values.push(updates.paymentMethod);
      }

      if (updates.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        values.push(updates.notes);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);

      const updateQuery = `
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        this.logger.warn('Order not found for update', { 
          operation: 'updateOrder',
          orderId: id 
        });
        return null;
      }

      await client.query('COMMIT');

      const order = result.rows[0];
      const [items, addresses] = await Promise.all([
        this.getOrderItems(id),
        this.getOrderAddresses(id)
      ]);

      const shippingAddress = addresses.find(addr => addr.type === 'shipping');
      const billingAddress = addresses.find(addr => addr.type === 'billing');

      const updatedOrder = {
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

      this.logger.businessEvent({
        eventType: 'order.updated',
        aggregateId: updatedOrder.id,
        aggregateType: 'Order',
        eventVersion: 1,
        correlationId: updatedOrder.correlationId || uuidv4(),
        timestamp: new Date().toISOString(),
        data: updatedOrder,
      });

      this.logger.info('Successfully updated order', { 
        operation: 'updateOrder',
        orderId: id,
        newStatus: updatedOrder.status
      });

      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update order', error as Error, { 
        operation: 'updateOrder',
        orderId: id 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteOrder(id: string): Promise<boolean> {
    try {
      this.logger.info('Deleting order', { operation: 'deleteOrder', orderId: id });
      
      const result = await this.pool.query('DELETE FROM orders WHERE id = $1', [id]);
      const deleted = (result.rowCount ?? 0) > 0;
      
      if (deleted) {
        this.logger.businessEvent({
          eventType: 'order.deleted',
          aggregateId: id,
          aggregateType: 'Order',
          eventVersion: 1,
          correlationId: uuidv4(),
          timestamp: new Date().toISOString(),
          data: { orderId: id },
        });
        
        this.logger.info('Successfully deleted order', { 
          operation: 'deleteOrder',
          orderId: id 
        });
      } else {
        this.logger.warn('Order not found for deletion', { 
          operation: 'deleteOrder',
          orderId: id 
        });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete order', error as Error, { 
        operation: 'deleteOrder',
        orderId: id 
      });
      throw error;
    }
  }

  private async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderId]
      );
      
      return result.rows.map(item => ({
        id: item.id,
        productId: item.product_id,
        quantity: item.quantity,
        price: parseFloat(item.price),
        createdAt: item.created_at
      }));
    } catch (error) {
      this.logger.error('Failed to get order items', error as Error, { 
        operation: 'getOrderItems',
        orderId 
      });
      throw error;
    }
  }

  private async getOrderAddresses(orderId: string): Promise<Array<Address & {type: string}>> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM addresses WHERE order_id = $1',
        [orderId]
      );
      
      return result.rows.map(addr => ({
        id: addr.id,
        type: addr.type,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postal_code,
        country: addr.country,
        zipCode: addr.zip_code,
        phone: addr.phone,
        createdAt: addr.created_at
      }));
    } catch (error) {
      this.logger.error('Failed to get order addresses', error as Error, { 
        operation: 'getOrderAddresses',
        orderId 
      });
      throw error;
    }
  }
}

// Create singleton instance
export const db = new DatabaseService(); 