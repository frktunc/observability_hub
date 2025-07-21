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
        // Schema is now managed by infrastructure scripts (e.g., docker-entrypoint-initdb.d)
        // This function can be used for future migrations if needed, but for now,
        // it will just confirm that the connection is ready.
        console.log('✅ Database schema is managed by infrastructure, skipping application-level initialization.');
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