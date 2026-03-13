import { Pool } from 'pg';
import { derivedConfig } from '../config';

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    // Use ONLY connectionString to avoid conflicts with individual params
    this.pool = new Pool({
      connectionString: derivedConfig.database.url,
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
    const maxAttempts = 5;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await this.pool.connect();
        await client.query('SELECT NOW()');
        client.release();

        console.log('✅ Database connected successfully');
        this.isConnected = true;

        await this.initializeSchema();
        return;
      } catch (error) {
        this.isConnected = false;
        console.error(`❌ Database connection failed (attempt ${attempt}/${maxAttempts}):`, error);
        if (attempt === maxAttempts) throw error;
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async initializeSchema(): Promise<void> {
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
