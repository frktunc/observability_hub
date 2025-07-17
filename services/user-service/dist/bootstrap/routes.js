"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRoutes = applyRoutes;
const health_1 = require("@/routes/health");
const users_1 = require("@/routes/users");
const metrics_1 = require("@/routes/metrics");
const config_1 = require("@/config");
function applyRoutes(app) {
    // Health check endpoint (before authentication)
    app.use('/health', health_1.healthRoutes);
    // Metrics endpoint
    if (config_1.config.METRICS_ENABLED) {
        app.use('/metrics', metrics_1.metricsRoutes);
    }
    // API routes
    app.use('/api/v1/users', users_1.userRoutes);
}
//# sourceMappingURL=routes.js.map