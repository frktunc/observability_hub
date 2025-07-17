"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const global_middleware_1 = require("@/bootstrap/global-middleware");
const routes_1 = require("@/bootstrap/routes");
const docs_1 = require("@/bootstrap/docs");
const middleware_1 = require("@observability-hub/observability/middleware");
function createApp() {
    const app = (0, express_1.default)();
    // Global middleware
    (0, global_middleware_1.applyGlobalMiddleware)(app);
    // Ana route'lar
    (0, routes_1.applyRoutes)(app);
    // API dokümantasyon endpointi
    (0, docs_1.applyDocsEndpoint)(app);
    // Error handling middleware (must be last)
    app.use(middleware_1.defaultErrorHandler);
    return app;
}
//# sourceMappingURL=app.js.map