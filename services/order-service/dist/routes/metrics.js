"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.json({
        service: config_1.config.SERVICE_NAME,
        timestamp: new Date().toISOString(),
        correlationId,
        metrics: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            version: process.version,
            platform: process.platform
        }
    });
});
exports.default = router;
//# sourceMappingURL=metrics.js.map