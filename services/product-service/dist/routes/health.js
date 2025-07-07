"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.json({
        status: 'healthy',
        service: config_1.config.SERVICE_NAME,
        version: config_1.config.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        correlationId,
        checks: {
            database: 'connected',
            rabbitmq: 'connected',
            redis: 'connected'
        }
    });
});
router.get('/ready', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.json({
        status: 'ready',
        service: config_1.config.SERVICE_NAME,
        timestamp: new Date().toISOString(),
        correlationId
    });
});
router.get('/live', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.json({
        status: 'alive',
        service: config_1.config.SERVICE_NAME,
        timestamp: new Date().toISOString(),
        correlationId
    });
});
exports.default = router;
//# sourceMappingURL=health.js.map