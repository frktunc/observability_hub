require('module-alias/register');
import { createServer, Server as HttpServer } from 'http';
import { createApp } from '@/app';
import { initializeServices } from '@/bootstrap/initialize-services';
import { logger } from '@/bootstrap/logger';
import { config } from '@/config';
import { db } from '@/services/database';
import { closeRedis } from '@/services/redis-client';
import express from 'express';

export class Server {
  private app: express.Application;
  private httpServer: HttpServer;

  constructor() {
    this.app = createApp();
    this.httpServer = createServer(this.app);
  }

  public async start(): Promise<void> {
    try {
      console.log('🔗 Initializing logger connection to RabbitMQ...');
      await logger.connect();
      console.log('✅ Logger connected to RabbitMQ');

      console.log('🔗 Initializing database connection...');
      await db.connect();

      console.log('🔗 Initializing Redis services...');
      await initializeServices();

      this.httpServer.listen(config.PORT, () => {
        logger.info('User service started successfully', {
          component: 'server',
          port: config.PORT,
          environment: config.NODE_ENV,
          serviceVersion: config.SERVICE_VERSION,
          databaseStatus: db.getConnectionStatus(),
        });
        console.log(`🚀 [DEBUG] User Service listen callback fired on port ${config.PORT}`);
        console.log(`📊 Health check: http://localhost:${config.PORT}/health`);
        console.log(`📈 Metrics: http://localhost:${config.PORT}/metrics`);
        console.log(`👥 Users API: http://localhost:${config.PORT}/api/v1/users`);
        console.log(`💾 Database: Connected and ready`);
      });

      this.setupSignalHandlers();
      this.setupProcessHandlers();
    } catch (error) {
      logger.error('Failed to start server', error as Error, {
        component: 'server',
      });
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupSignalHandlers(): void {
    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully`);

      this.httpServer.close(async () => {
        try {
          await db.disconnect();
          console.log('💾 Database disconnected');
        } catch (error) {
          console.error('Error disconnecting database:', error);
        }

        try {
          await closeRedis();
          console.log('🔌 Redis disconnected');
        } catch (error) {
          console.error('Error disconnecting Redis:', error);
        }

        console.log('Server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  private setupProcessHandlers(): void {
    // IMPORTANT: Do NOT use async logger here — calling async functions inside
    // uncaughtException/unhandledRejection handlers can create infinite crash loops.
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('💥 Unhandled rejection:', reason);
      process.exit(1);
    });
  }
}
