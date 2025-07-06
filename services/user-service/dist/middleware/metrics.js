"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegistry = void 0;
exports.metricsMiddleware = metricsMiddleware;
function metricsMiddleware(req, res, next) {
    // Simple metrics tracking
    // In production, you'd use Prometheus or similar
    next();
}
exports.metricsRegistry = {
// Placeholder for metrics registry
};
//# sourceMappingURL=metrics.js.map