import { Pool, Client } from 'pg';
import { config, derivedConfig } from '../config';

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      connectionString: derivedConfig.database.url,
      host: derivedConfig.database.host,
      port: derivedConfig.database.port,
      database: derivedConfig.database.name,
      user: derivedConfig.database.user,
      password: derivedConfig.database.password,
      min: derivedConfig.database.pool.min,
      max: derivedConfig.database.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: derivedConfig.database.timeout,
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('connect', () => {
      console.log('Database client connected');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('✅ Database connected successfully');
      this.isConnected = true;
      
      // Initialize schema
      await this.initializeSchema();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async initializeSchema(): Promise<void> {
    // Schema is now managed by infrastructure scripts (e.g., docker-entrypoint-initdb.d)
    // This function can be used for future migrations if needed, but for now,
    // it will just confirm that the connection is ready.
    console.log('✅ Database schema is managed by infrastructure, skipping application-level initialization.');
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database disconnected');
    } catch (error) {
      console.error('Error disconnecting database:', error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Create singleton instance
export const db = new DatabaseService();
