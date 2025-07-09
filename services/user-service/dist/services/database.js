"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.DatabaseService = void 0;
const pg_1 = require("pg");
const config_1 = require("../config");
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
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: config_1.derivedConfig.database.timeout,
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
    async connect() {
        try {
            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            console.log('✅ Database connected successfully');
            this.isConnected = true;
            // Initialize schema
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
            // Create users table if it doesn't exist
            const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create updated_at trigger
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Drop trigger if exists and create new one
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      `;
            await client.query(createUsersTable);
            console.log('✅ Database schema initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize database schema:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async query(text, params) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        try {
            const result = await this.pool.query(text, params);
            return result;
        }
        catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
    async getClient() {
        return await this.pool.connect();
    }
    async disconnect() {
        try {
            await this.pool.end();
            this.isConnected = false;
            console.log('Database disconnected');
        }
        catch (error) {
            console.error('Error disconnecting database:', error);
            throw error;
        }
    }
    getConnectionStatus() {
        return this.isConnected;
    }
}
exports.DatabaseService = DatabaseService;
// Create singleton instance
exports.db = new DatabaseService();
//# sourceMappingURL=database.js.map