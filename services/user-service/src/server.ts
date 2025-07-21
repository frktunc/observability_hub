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
        console.log(`🚀 User Service is running on port ${config.PORT}`);
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
      logger.info(`Received ${signal}, shutting down gracefully`, {
        component: 'server',
        signal,
      });

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

        logger.info('Server closed', {
          component: 'server',
        });
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout', undefined, {
          component: 'server',
        });
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  private setupProcessHandlers(): void {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error as Error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', reason as Error);
      process.exit(1);
    });
  }
}
