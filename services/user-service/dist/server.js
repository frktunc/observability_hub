"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
require('module-alias/register');
const http_1 = require("http");
const app_1 = require("@/app");
const initialize_services_1 = require("@/bootstrap/initialize-services");
const logger_1 = require("@/bootstrap/logger");
const config_1 = require("@/config");
const database_1 = require("@/services/database");
const redis_client_1 = require("@/services/redis-client");
class Server {
    app;
    httpServer;
    constructor() {
        this.app = (0, app_1.createApp)();
        this.httpServer = (0, http_1.createServer)(this.app);
    }
    async start() {
        try {
            console.log('🔗 Initializing database connection...');
            await database_1.db.connect();
            console.log('🔗 Initializing Redis services...');
            await (0, initialize_services_1.initializeServices)();
            this.httpServer.listen(config_1.config.PORT, () => {
                logger_1.logger.info('User service started successfully', {
                    component: 'server',
                    port: config_1.config.PORT,
                    environment: config_1.config.NODE_ENV,
                    serviceVersion: config_1.config.SERVICE_VERSION,
                    databaseStatus: database_1.db.getConnectionStatus(),
                });
                console.log(`🚀 User Service is running on port ${config_1.config.PORT}`);
                console.log(`📊 Health check: http://localhost:${config_1.config.PORT}/health`);
                console.log(`📈 Metrics: http://localhost:${config_1.config.PORT}/metrics`);
                console.log(`👥 Users API: http://localhost:${config_1.config.PORT}/api/v1/users`);
                console.log(`💾 Database: Connected and ready`);
            });
            this.setupSignalHandlers();
            this.setupProcessHandlers();
        }
        catch (error) {
            logger_1.logger.error('Failed to start server', error, {
                component: 'server',
            });
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
    setupSignalHandlers() {
        const gracefulShutdown = (signal) => {
            logger_1.logger.info(`Received ${signal}, shutting down gracefully`, {
                component: 'server',
                signal,
            });
            this.httpServer.close(async () => {
                try {
                    await database_1.db.disconnect();
                    console.log('💾 Database disconnected');
                }
                catch (error) {
                    console.error('Error disconnecting database:', error);
                }
                try {
                    await (0, redis_client_1.closeRedis)();
                    console.log('🔌 Redis disconnected');
                }
                catch (error) {
                    console.error('Error disconnecting Redis:', error);
                }
                logger_1.logger.info('Server closed', {
                    component: 'server',
                });
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown after timeout', undefined, {
                    component: 'server',
                });
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught exception', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error('Unhandled rejection', reason);
            process.exit(1);
        });
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map