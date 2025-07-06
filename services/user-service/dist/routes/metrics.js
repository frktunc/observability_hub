"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRoutes = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.metricsRoutes = router;
router.get('/', (req, res) => {
    res.json({
        metrics: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        },
    });
});
//# sourceMappingURL=metrics.js.map