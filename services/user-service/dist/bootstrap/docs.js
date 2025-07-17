"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDocsEndpoint = applyDocsEndpoint;
const config_1 = require("../config");
function applyDocsEndpoint(app) {
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
}
//# sourceMappingURL=docs.js.map