import { Pool, PoolClient, QueryResult } from 'pg';
import { ObservabilityLogger } from '@observability-hub/observability';
import { config, derivedConfig } from '../config';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  sku: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  category: string;
  sku: string;
  stock_quantity?: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  sku?: string;
  stock_quantity?: number;
  is_active?: boolean;
}

export interface ProductFilters {
  category?: string;
  min_price?: number;
  max_price?: number;
  is_active?: boolean;
  search?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

class DatabaseService {
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
    } catch (error) {
      this.logger.error('Database connection failed', error as Error, { component: 'database' });
      this.isConnected = false;
      throw error;
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

  // Product operations
  async getAllProducts(filters: ProductFilters = {}, pagination: PaginationOptions = {}): Promise<{
    products: Product[];
    total: number;
  }> {
    try {
      this.logger.debug('Fetching all products', { 
        operation: 'getAllProducts',
        filters,
        pagination
      });

      const { limit = 50, offset = 0 } = pagination;
      const { category, min_price, max_price, is_active = true, search } = filters;

      let whereClause = 'WHERE is_active = $1';
      const queryParams: any[] = [is_active];
      let paramIndex = 2;

      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
      }

      if (min_price !== undefined) {
        whereClause += ` AND price >= $${paramIndex}`;
        queryParams.push(min_price);
        paramIndex++;
      }

      if (max_price !== undefined) {
        whereClause += ` AND price <= $${paramIndex}`;
        queryParams.push(max_price);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const countQuery = `SELECT COUNT(*) FROM products ${whereClause}`;
      const dataQuery = `
        SELECT * FROM products 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);

      const [countResult, dataResult] = await Promise.all([
        this.pool.query(countQuery, queryParams.slice(0, -2)),
        this.pool.query(dataQuery, queryParams)
      ]);

      this.logger.info('Successfully fetched all products', { 
        operation: 'getAllProducts',
        total: parseInt(countResult.rows[0].count),
        returned: dataResult.rows.length
      });

      return {
        products: dataResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      this.logger.error('Failed to fetch products', error as Error, { operation: 'getAllProducts' });
      throw error;
    }
  }

  async getProductById(id: string): Promise<Product | null> {
    try {
      this.logger.debug('Fetching product by ID', { operation: 'getProductById', productId: id });
      
      const result = await this.pool.query(
        'SELECT * FROM products WHERE id = $1 AND is_active = true',
        [id]
      );
      
      const product = result.rows[0] || null;
      
      if (product) {
        this.logger.info('Successfully fetched product by ID', { 
          operation: 'getProductById', 
          productId: id,
          productName: product.name
        });
      } else {
        this.logger.warn('Product not found by ID', { 
          operation: 'getProductById', 
          productId: id 
        });
      }
      
      return product;
    } catch (error) {
      this.logger.error('Failed to fetch product by ID', error as Error, { 
        operation: 'getProductById', 
        productId: id 
      });
      throw error;
    }
  }

  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      this.logger.debug('Fetching product by SKU', { operation: 'getProductBySku', sku });
      
      const result = await this.pool.query(
        'SELECT * FROM products WHERE sku = $1 AND is_active = true',
        [sku]
      );
      
      const product = result.rows[0] || null;
      
      if (product) {
        this.logger.info('Successfully fetched product by SKU', { 
          operation: 'getProductBySku', 
          sku,
          productName: product.name
        });
      } else {
        this.logger.warn('Product not found by SKU', { 
          operation: 'getProductBySku', 
          sku 
        });
      }
      
      return product;
    } catch (error) {
      this.logger.error('Failed to fetch product by SKU', error as Error, { 
        operation: 'getProductBySku', 
        sku 
      });
      throw error;
    }
  }

  async createProduct(productData: CreateProductRequest): Promise<Product> {
    try {
      this.logger.info('Creating new product', { 
        operation: 'createProduct',
        productName: productData.name,
        sku: productData.sku,
        category: productData.category,
        price: productData.price
      });

      const {
        name,
        description,
        price,
        category,
        sku,
        stock_quantity = 0
      } = productData;

      const result = await this.pool.query(
        `INSERT INTO products (name, description, price, category, sku, stock_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, description, price, category, sku, stock_quantity]
      );

      const newProduct = result.rows[0];

      this.logger.businessEvent({
        eventType: 'product.created',
        aggregateId: newProduct.id,
        aggregateType: 'Product',
        eventVersion: 1,
        correlationId: newProduct.id,
        timestamp: new Date().toISOString(),
        data: newProduct,
      });

      this.logger.info('Successfully created product', { 
        operation: 'createProduct',
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku
      });

      return newProduct;
    } catch (error) {
      this.logger.error('Failed to create product', error as Error, { 
        operation: 'createProduct',
        productName: productData.name,
        sku: productData.sku
      });
      throw error;
    }
  }

  async updateProduct(id: string, updates: UpdateProductRequest): Promise<Product | null> {
    try {
      this.logger.info('Updating product', { 
        operation: 'updateProduct',
        productId: id,
        updateFields: Object.keys(updates)
      });

      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      queryParams.push(id);

      const updateQuery = `
        UPDATE products 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(updateQuery, queryParams);
      
      if (result.rows.length === 0) {
        this.logger.warn('Product not found for update', { 
          operation: 'updateProduct',
          productId: id 
        });
        return null;
      }

      const updatedProduct = result.rows[0];

      this.logger.businessEvent({
        eventType: 'product.updated',
        aggregateId: updatedProduct.id,
        aggregateType: 'Product',
        eventVersion: 1,
        correlationId: updatedProduct.id,
        timestamp: new Date().toISOString(),
        data: updatedProduct,
      });

      this.logger.info('Successfully updated product', { 
        operation: 'updateProduct',
        productId: id,
        productName: updatedProduct.name
      });

      return updatedProduct;
    } catch (error) {
      this.logger.error('Failed to update product', error as Error, { 
        operation: 'updateProduct',
        productId: id 
      });
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      this.logger.info('Deleting product', { operation: 'deleteProduct', productId: id });
      
      const result = await this.pool.query(
        'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      
      const deleted = (result.rowCount ?? 0) > 0;
      
      if (deleted) {
        this.logger.businessEvent({
          eventType: 'product.deleted',
          aggregateId: id,
          aggregateType: 'Product',
          eventVersion: 1,
          correlationId: id,
          timestamp: new Date().toISOString(),
          data: { productId: id },
        });
        
        this.logger.info('Successfully deleted product', { 
          operation: 'deleteProduct',
          productId: id 
        });
      } else {
        this.logger.warn('Product not found for deletion', { 
          operation: 'deleteProduct',
          productId: id 
        });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete product', error as Error, { 
        operation: 'deleteProduct',
        productId: id 
      });
      throw error;
    }
  }

  async getProductStats(): Promise<{
    total_products: number;
    total_categories: number;
    total_stock_value: number;
    low_stock_products: number;
  }> {
    try {
      this.logger.debug('Fetching product statistics', { operation: 'getProductStats' });
      
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT category) as total_categories,
          COALESCE(SUM(price * stock_quantity), 0) as total_stock_value,
          COUNT(CASE WHEN stock_quantity < 10 THEN 1 END) as low_stock_products
        FROM products 
        WHERE is_active = true
      `);
      
      const stats = result.rows[0];
      
      this.logger.info('Successfully fetched product statistics', { 
        operation: 'getProductStats',
        totalProducts: stats.total_products,
        totalCategories: stats.total_categories,
        totalStockValue: stats.total_stock_value,
        lowStockProducts: stats.low_stock_products
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch product statistics', error as Error, { operation: 'getProductStats' });
      throw error;
    }
  }
}

// Create singleton instance
export const db = new DatabaseService(); 