"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublisher = createPublisher;
const uuid_1 = require("uuid");
const types_1 = require("./types");
function createPublisher(config, connection, circuitBreaker) {
    async function publishMessage(message, options = {}) {
        const messageId = options.messageId || (0, uuid_1.v4)();
        if (!circuitBreaker.isRequestAllowed()) {
            const error = new Error('Circuit breaker is OPEN');
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error,
            };
        }
        if (!connection.isConnected || !connection.channel) {
            const error = new Error('RabbitMQ connection not available');
            circuitBreaker.recordFailure();
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error,
            };
        }
        try {
            const routingKey = options.routingKey || getRoutingKeyForLogLevel(message.level);
            const eventId = (0, uuid_1.v4)();
            const timestamp = new Date().toISOString();
            const enrichedMessage = {
                eventId,
                eventType: `log.${message.level.toLowerCase()}.created`,
                version: '1.0.0',
                timestamp,
                correlationId: message.correlationId || options.correlationId || (0, uuid_1.v4)(),
                source: {
                    service: config.serviceName,
                    version: config.serviceVersion,
                    instance: process.env.HOSTNAME || 'unknown',
                    region: process.env.REGION || undefined,
                },
                data: {
                    level: message.level,
                    message: message.message,
                    timestamp,
                    context: message.context || undefined,
                    structured: message.metadata
                        ? { fields: message.metadata }
                        : undefined,
                    error: message.error || undefined,
                },
                metadata: {
                    priority: message.level === 'ERROR' || message.level === 'FATAL'
                        ? 'high'
                        : 'normal',
                    tags: [],
                    environment: config.environment,
                },
            };
            const publishOptions = {
                persistent: options.persistent ?? true,
                messageId,
                timestamp: Date.now(),
                correlationId: enrichedMessage.correlationId,
                headers: {
                    ...options.headers,
                    'x-producer': config.serviceName,
                    'x-publish-time': new Date().toISOString(),
                },
                ...options,
            };
            const buffer = Buffer.from(JSON.stringify(enrichedMessage));
            await connection.channel.publish(config.rabbitmqExchange, routingKey, buffer, publishOptions);
            circuitBreaker.recordSuccess();
            return {
                success: true,
                messageId,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            circuitBreaker.recordFailure();
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
    function getRoutingKeyForLogLevel(level) {
        const levelMap = {
            [types_1.LogLevel.TRACE]: 'logs.debug',
            [types_1.LogLevel.DEBUG]: 'logs.debug',
            [types_1.LogLevel.INFO]: 'logs.info',
            [types_1.LogLevel.WARN]: 'logs.warning',
            [types_1.LogLevel.ERROR]: 'logs.error',
            [types_1.LogLevel.FATAL]: 'logs.error',
        };
        return levelMap[level] || 'logs.info';
    }
    return { publishMessage };
}
//# sourceMappingURL=publisher.js.map