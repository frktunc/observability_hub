"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeServices = initializeServices;
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const observability_1 = require("@observability-hub/observability");
const config_1 = require("./config");
const middleware_1 = require("@observability-hub/observability/dist/middleware");
const rate_limiting_1 = require("./middleware/rate-limiting");
const redis_client_1 = require("./services/redis-client");
const health_1 = __importDefault(require("./routes/health"));
const products_1 = __importDefault(require("./routes/products"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const logger = new observability_1.ObservabilityLogger({
    serviceName: config_1.config.SERVICE_NAME,
    serviceVersion: config_1.config.SERVICE_VERSION,
    environment: config_1.config.NODE_ENV,
    rabbitmqUrl: config_1.derivedConfig.rabbitmq.url,
    rabbitmqVhost: config_1.derivedConfig.rabbitmq.vhost,
    rabbitmqExchange: config_1.derivedConfig.rabbitmq.exchange,
    defaultLogLevel: config_1.config.LOG_LEVEL,
});
async function initializeServices() {
    try {
        if (config_1.derivedConfig.redis.rateLimiting.enabled) {
            await (0, redis_client_1.initializeRedis)();
            console.log('🎯 Redis services initialized successfully');
        }
        else {
            console.log('⚠️ Redis rate limiting disabled, using memory fallback');
        }
    }
    catch (error) {
        console.error('❌ Failed to initialize Redis, falling back to memory rate limiting:', error);
    }
}
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://your-domain.com']
            : true,
        credentials: true,
        maxAge: 86400,
    }));
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
    app.use(express_1.default.json({
        limit: '10mb'
    }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: '10mb'
    }));
    if (config_1.config.RATE_LIMIT_ENABLED) {
        const rateLimitMiddleware = (0, rate_limiting_1.createRateLimitMiddleware)();
        app.use(rateLimitMiddleware);
    }
    app.use(middleware_1.defaultCorrelationIdMiddleware);
    app.use((0, middleware_1.requestLoggingMiddleware)({
        customLogger: (level, message, metadata) => {
            console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
        }
    }));
    if (config_1.config.METRICS_ENABLED) {
        app.use(middleware_1.defaultMetrics);
    }
    app.use('/health', health_1.default);
    if (config_1.config.METRICS_ENABLED) {
        app.use('/metrics', metrics_1.default);
    }
    app.use('/api/v1/products', products_1.default);
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
                products: '/api/v1/products',
                documentation: '/api/v1/docs',
            },
        });
    });
    app.get('/api/v1/docs', (req, res) => {
        res.json({
            openapi: '3.0.0',
            info: {
                title: 'Product Service API',
                version: config_1.config.SERVICE_VERSION,
                description: 'Product management microservice with observability logging',
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
                '/api/v1/products': {
                    get: {
                        summary: 'List all products',
                        responses: {
                            '200': {
                                description: 'List of products',
                            },
                        },
                    },
                    post: {
                        summary: 'Create a new product',
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
    app.use(middleware_1.defaultErrorHandler);
    return app;
}
//# sourceMappingURL=app.js.map