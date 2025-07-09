import { Pool, PoolClient, QueryResult } from 'pg';
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

  constructor() {
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
      console.log('Database client connected');
      this.isConnected = true;
    });

    this.pool.on('error', (err: Error) => {
      console.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      console.log('Database client removed from pool');
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('✅ Database connected successfully');
      console.log('✅ Database schema initialized');
      this.isConnected = true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      console.log('Database disconnected');
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from database:', error);
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

    try {
      const [countResult, dataResult] = await Promise.all([
        this.pool.query(countQuery, queryParams.slice(0, -2)),
        this.pool.query(dataQuery, queryParams)
      ]);

      return {
        products: dataResult.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProductById(id: string): Promise<Product | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM products WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;
    }
  }

  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM products WHERE sku = $1 AND is_active = true',
        [sku]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching product by SKU:', error);
      throw error;
    }
  }

  async createProduct(productData: CreateProductRequest): Promise<Product> {
    const {
      name,
      description,
      price,
      category,
      sku,
      stock_quantity = 0
    } = productData;

    try {
      const result = await this.pool.query(
        `INSERT INTO products (name, description, price, category, sku, stock_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, description, price, category, sku, stock_quantity]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id: string, updates: UpdateProductRequest): Promise<Product | null> {
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

    try {
      const result = await this.pool.query(
        `UPDATE products 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramIndex} AND is_active = true
         RETURNING *`,
        queryParams
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error deleting product:', error);
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
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT category) as total_categories,
          SUM(price * stock_quantity) as total_stock_value,
          COUNT(*) FILTER (WHERE stock_quantity < 10) as low_stock_products
        FROM products 
        WHERE is_active = true
      `);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching product stats:', error);
      throw error;
    }
  }
}

// Singleton instance
export const db = new DatabaseService();

export default db; 