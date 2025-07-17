"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyGlobalMiddleware = applyGlobalMiddleware;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("../config");
const middleware_1 = require("@observability-hub/observability/middleware");
const rate_limiting_1 = require("../middleware/rate-limiting");
function applyGlobalMiddleware(app) {
    // Trust proxy for accurate client IPs
    app.set('trust proxy', 1);
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    // CORS configuration
    app.use((0, cors_1.default)({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://your-domain.com']
            : true,
        credentials: true,
        maxAge: 86400, // 24 hours
    }));
    // Compression middleware
    if (config_1.config.FEATURE_COMPRESSION) {
        app.use((0, compression_1.default)({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression_1.default.filter(req, res);
            },
        }));
    }
    // Body parsing middleware
    app.use(require('express').json({
        limit: '10mb'
    }));
    app.use(require('express').urlencoded({
        extended: true,
        limit: '10mb'
    }));
    // Redis-based rate limiting
    if (config_1.config.RATE_LIMIT_ENABLED) {
        const rateLimitMiddleware = (0, rate_limiting_1.createRateLimitMiddleware)();
        app.use(rateLimitMiddleware);
    }
    // Custom middleware (using shared middleware)
    app.use(middleware_1.defaultCorrelationIdMiddleware);
    app.use((0, middleware_1.requestLoggingMiddleware)({
        customLogger: (level, message, metadata) => {
            console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
        }
    }));
    // Metrics middleware
    if (config_1.config.METRICS_ENABLED) {
        app.use((0, middleware_1.metricsMiddleware)());
    }
}
//# sourceMappingURL=global-middleware.js.map