"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const log_client_1 = require("@observability-hub/log-client");
const config_1 = require("./config");
const metrics_1 = require("./middleware/metrics");
const request_logging_1 = require("./middleware/request-logging");
const error_handler_1 = require("./middleware/error-handler");
const correlation_id_1 = require("./middleware/correlation-id");
const health_1 = require("./routes/health");
const users_1 = require("./routes/users");
const metrics_2 = require("./routes/metrics");
// Initialize observability logger
const logger = new log_client_1.ObservabilityLogger({
    serviceName: 'user-service',
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.config.RABBITMQ_URL,
    rabbitmqVhost: config_1.config.RABBITMQ_VHOST,
    rabbitmqExchange: config_1.config.RABBITMQ_EXCHANGE,
});
function createApp() {
    const app = (0, express_1.default)();
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
    app.use(express_1.default.json({
        limit: '10mb'
    }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: '10mb'
    }));
    // Rate limiting
    if (config_1.config.RATE_LIMIT_ENABLED) {
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: config_1.config.RATE_LIMIT_WINDOW_MS,
            max: config_1.config.RATE_LIMIT_MAX_REQUESTS,
            message: {
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(config_1.config.RATE_LIMIT_WINDOW_MS / 1000),
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                // Use tenant ID for multi-tenant rate limiting
                const tenantId = req.headers[config_1.config.TENANT_HEADER_NAME] || config_1.config.DEFAULT_TENANT_ID;
                const clientId = req.ip || 'unknown';
                return `${tenantId}:${clientId}`;
            },
        });
        app.use(limiter);
        // Speed limiter for additional protection
        const speedLimiter = (0, express_slow_down_1.default)({
            windowMs: config_1.config.RATE_LIMIT_WINDOW_MS,
            delayAfter: Math.floor(config_1.config.RATE_LIMIT_MAX_REQUESTS * 0.5),
            delayMs: () => 500,
            maxDelayMs: 20000,
        });
        app.use(speedLimiter);
    }
    // Custom middleware
    app.use(correlation_id_1.correlationIdMiddleware);
    app.use(request_logging_1.requestLoggingMiddleware);
    if (config_1.config.METRICS_ENABLED) {
        app.use(metrics_1.metricsMiddleware);
    }
    // Health check endpoint (before authentication)
    app.use('/health', health_1.healthRoutes);
    // Metrics endpoint
    if (config_1.config.METRICS_ENABLED) {
        app.use('/metrics', metrics_2.metricsRoutes);
    }
    // API routes
    app.use('/api/v1/users', users_1.userRoutes);
    // Welcome endpoint
    app.get('/', (req, res) => {
        res.json({
            service: config_1.config.SERVICE_NAME,
            version: config_1.config.SERVICE_VERSION,
            environment: config_1.config.NODE_ENV,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            endpoints: {
                health: '/health',
                metrics: '/metrics',
                users: '/api/v1/users',
                documentation: '/api/v1/docs',
            },
        });
    });
    // API documentation endpoint
    app.get('/api/v1/docs', (req, res) => {
        res.json({
            openapi: '3.0.0',
            info: {
                title: 'User Service API',
                version: config_1.config.SERVICE_VERSION,
                description: 'User management microservice with observability logging',
            },
            servers: [
                {
                    url: `http://localhost:${config_1.config.PORT}`,
                    description: 'Development server',
                },
            ],
            paths: {
                '/health': {
                    get: {
                        summary: 'Health check endpoint',
                        responses: {
                            '200': {
                                description: 'Service is healthy',
                            },
                        },
                    },
                },
                '/metrics': {
                    get: {
                        summary: 'Prometheus metrics endpoint',
                        responses: {
                            '200': {
                                description: 'Metrics in Prometheus format',
                            },
                        },
                    },
                },
                '/api/v1/users': {
                    get: {
                        summary: 'List all users',
                        responses: {
                            '200': {
                                description: 'List of users',
                            },
                        },
                    },
                    post: {
                        summary: 'Create a new user',
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        required: ['name', 'email'],
                                        properties: {
                                            name: {
                                                type: 'string',
                                                description: 'User full name',
                                            },
                                            email: {
                                                type: 'string',
                                                format: 'email',
                                                description: 'User email address',
                                            },
                                            role: {
                                                type: 'string',
                                                enum: ['user', 'admin', 'moderator'],
                                                default: 'user',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            '201': {
                                description: 'User created successfully',
                            },
                            '400': {
                                description: 'Invalid input data',
                            },
                        },
                    },
                },
                '/api/v1/users/{id}': {
                    get: {
                        summary: 'Get user by ID',
                        parameters: [
                            {
                                name: 'id',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string',
                                },
                            },
                        ],
                        responses: {
                            '200': {
                                description: 'User details',
                            },
                            '404': {
                                description: 'User not found',
                            },
                        },
                    },
                    put: {
                        summary: 'Update user',
                        parameters: [
                            {
                                name: 'id',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string',
                                },
                            },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            name: {
                                                type: 'string',
                                            },
                                            email: {
                                                type: 'string',
                                                format: 'email',
                                            },
                                            role: {
                                                type: 'string',
                                                enum: ['user', 'admin', 'moderator'],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            '200': {
                                description: 'User updated successfully',
                            },
                            '404': {
                                description: 'User not found',
                            },
                        },
                    },
                    delete: {
                        summary: 'Delete user',
                        parameters: [
                            {
                                name: 'id',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string',
                                },
                            },
                        ],
                        responses: {
                            '204': {
                                description: 'User deleted successfully',
                            },
                            '404': {
                                description: 'User not found',
                            },
                        },
                    },
                },
            },
        });
    });
    // Error handling middleware (must be last)
    app.use(error_handler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map