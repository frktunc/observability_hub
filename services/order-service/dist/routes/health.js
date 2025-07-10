"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const database_1 = require("../services/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const dbStatus = database_1.db.getConnectionStatus();
        const healthStatus = {
            status: dbStatus ? 'healthy' : 'degraded',
            service: config_1.config.SERVICE_NAME,
            version: config_1.config.SERVICE_VERSION,
            timestamp: new Date().toISOString(),
            correlationId,
            checks: {
                database: {
                    status: dbStatus ? 'connected' : 'disconnected',
                    connection: dbStatus
                },
                application: {
                    status: 'running',
                    uptime: process.uptime(),
                    memory: process.memoryUsage()
                }
            }
        };
        const statusCode = dbStatus ? 200 : 503;
        res.status(statusCode).json(healthStatus);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(503).json({
            status: 'unhealthy',
            service: config_1.config.SERVICE_NAME,
            version: config_1.config.SERVICE_VERSION,
            timestamp: new Date().toISOString(),
            correlationId,
            error: errorMessage,
            checks: {
                database: {
                    status: 'error',
                    connection: false
                },
                application: {
                    status: 'error'
                }
            }
        });
    }
});
router.get('/ready', async (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    try {
        const dbStatus = database_1.db.getConnectionStatus();
        if (dbStatus) {
            res.json({
                status: 'ready',
                service: config_1.config.SERVICE_NAME,
                version: config_1.config.SERVICE_VERSION,
                timestamp: new Date().toISOString(),
                correlationId,
                dependencies: {
                    database: 'ready'
                }
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                service: config_1.config.SERVICE_NAME,
                version: config_1.config.SERVICE_VERSION,
                timestamp: new Date().toISOString(),
                correlationId,
                dependencies: {
                    database: 'not ready'
                }
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(503).json({
            status: 'not ready',
            service: config_1.config.SERVICE_NAME,
            version: config_1.config.SERVICE_VERSION,
            timestamp: new Date().toISOString(),
            correlationId,
            error: errorMessage
        });
    }
});
router.get('/live', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.json({
        status: 'alive',
        service: config_1.config.SERVICE_NAME,
        version: config_1.config.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        correlationId,
        process: {
            pid: process.pid,
            uptime: process.uptime(),
            nodeVersion: process.version
        }
    });
});
exports.default = router;
//# sourceMappingURL=health.js.map