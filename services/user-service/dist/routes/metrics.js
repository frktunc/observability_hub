"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRoutes = void 0;
const express_1 = require("express");
const prom_client_1 = require("prom-client");
const router = (0, express_1.Router)();
exports.metricsRoutes = router;
/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     description: Returns application metrics in Prometheus format.
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Failed to retrieve metrics.
 */
router.get('/', async (req, res) => {
    try {
        res.set('Content-Type', prom_client_1.register.contentType);
        res.end(await prom_client_1.register.metrics());
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({
            error: 'Failed to get metrics',
            details: errorMessage,
        });
    }
});
//# sourceMappingURL=metrics.js.map