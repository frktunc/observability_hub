"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = void 0;
const metricsMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.route?.path || req.path;
    console.log(`[METRICS] ${method} ${path} - ${Date.now() - startTime}ms`);
    next();
};
exports.metricsMiddleware = metricsMiddleware;
//# sourceMappingURL=metrics.js.map