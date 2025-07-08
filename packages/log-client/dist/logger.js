"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityLogger = void 0;
const amqplib_1 = require("amqplib");
const uuid_1 = require("uuid");
const types_1 = require("./types");
class ObservabilityLogger {
    connection = null;
    channel = null;
    config;
    isConnected = false;
    reconnectAttempts = 0;
    metrics;
    circuitBreakerState = 'CLOSED';
    circuitBreakerFailures = 0;
    circuitBreakerLastFailure;
    batchQueue = [];
    batchTimer;
    constructor(config) {
        this.config = {
            ...config,
            serviceName: config.serviceName,
            serviceVersion: config.serviceVersion || '1.0.0',
            environment: config.environment || 'development',
            rabbitmqHostname: config.rabbitmqHostname || 'localhost',
            rabbitmqPort: config.rabbitmqPort || 5672,
            rabbitmqVhost: config.rabbitmqVhost || 'observability',
            rabbitmqExchange: config.rabbitmqExchange || 'logs.topic',
            connectionTimeout: config.connectionTimeout || 30000,
            heartbeat: config.heartbeat || 60,
            maxRetries: config.maxRetries || 5,
            retryDelayMs: config.retryDelayMs || 2000,
            defaultLogLevel: config.defaultLogLevel || types_1.LogLevel.INFO,
            enableBatching: config.enableBatching || false,
            batchSize: config.batchSize || 100,
            batchTimeoutMs: config.batchTimeoutMs || 5000,
            enableCircuitBreaker: config.enableCircuitBreaker || true,
            circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
        };
        this.metrics = {
            messagesPublished: 0,
            messagesFailed: 0,
            messagesConfirmed: 0,
            connectionStatus: 'disconnected',
            averagePublishTime: 0,
        };
        this.connect().catch(console.error);
    }
    async connect() {
        try {
            const { rabbitmqHostname, rabbitmqPort, rabbitmqUsername, rabbitmqPassword, rabbitmqVhost, heartbeat, connectionTimeout, } = this.config;
            const connOptions = {
                protocol: 'amqp',
                hostname: rabbitmqHostname,
                port: rabbitmqPort,
                username: rabbitmqUsername,
                password: rabbitmqPassword,
                vhost: rabbitmqVhost,
                heartbeat: heartbeat,
                timeout: connectionTimeout,
            };
            this.connection = await (0, amqplib_1.connect)(connOptions);
            this.channel = await this.connection.createChannel();
            if (this.channel) {
                await this.channel.assertExchange(this.config.rabbitmqExchange, 'topic', { durable: true });
            }
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.metrics.connectionStatus = 'connected';
            if (this.connection) {
                this.connection.on('error', this.handleConnectionError.bind(this));
                this.connection.on('close', this.handleConnectionClose.bind(this));
            }
            console.log(`[ObservabilityLogger] Connected to RabbitMQ: ${this.config.serviceName}`);
        }
        catch (error) {
            console.error('[ObservabilityLogger] Connection failed:', error);
            this.metrics.connectionStatus = 'disconnected';
            if (this.reconnectAttempts < this.config.maxRetries) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.config.retryDelayMs * this.reconnectAttempts);
            }
        }
    }
    handleConnectionError(error) {
        console.error('[ObservabilityLogger] Connection error:', error);
        this.isConnected = false;
        this.metrics.connectionStatus = 'reconnecting';
    }
    handleConnectionClose() {
        console.log('[ObservabilityLogger] Connection closed, attempting to reconnect...');
        this.isConnected = false;
        this.metrics.connectionStatus = 'reconnecting';
        this.connect().catch(console.error);
    }
    isCircuitBreakerOpen() {
        if (!this.config.enableCircuitBreaker)
            return false;
        if (this.circuitBreakerState === 'OPEN') {
            const timeSinceLastFailure = this.circuitBreakerLastFailure
                ? Date.now() - this.circuitBreakerLastFailure.getTime()
                : 0;
            if (timeSinceLastFailure > this.config.circuitBreakerTimeout) {
                this.circuitBreakerState = 'HALF_OPEN';
                this.circuitBreakerFailures = 0;
            }
        }
        return this.circuitBreakerState === 'OPEN';
    }
    recordCircuitBreakerSuccess() {
        if (this.circuitBreakerState === 'HALF_OPEN') {
            this.circuitBreakerState = 'CLOSED';
            this.circuitBreakerFailures = 0;
        }
    }
    recordCircuitBreakerFailure() {
        this.circuitBreakerFailures++;
        this.circuitBreakerLastFailure = new Date();
        if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
            this.circuitBreakerState = 'OPEN';
        }
    }
    async publishMessage(message, options = {}) {
        const startTime = Date.now();
        const messageId = options.messageId || (0, uuid_1.v4)();
        if (this.isCircuitBreakerOpen()) {
            const error = new Error('Circuit breaker is OPEN');
            this.metrics.messagesFailed++;
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error,
            };
        }
        if (!this.isConnected || !this.channel) {
            const error = new Error('RabbitMQ connection not available');
            this.metrics.messagesFailed++;
            this.recordCircuitBreakerFailure();
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error,
            };
        }
        try {
            const routingKey = options.routingKey || this.getRoutingKeyForLogLevel(message.level);
            const enrichedMessage = {
                ...message,
                correlationId: message.correlationId || options.correlationId || (0, uuid_1.v4)(),
                timestamp: new Date().toISOString(),
                source: {
                    service: this.config.serviceName,
                    version: this.config.serviceVersion,
                    host: process.env.HOSTNAME || 'unknown',
                    environment: this.config.environment,
                },
            };
            const publishOptions = {
                persistent: options.persistent ?? true,
                messageId,
                timestamp: Date.now(),
                correlationId: enrichedMessage.correlationId,
                headers: {
                    ...options.headers,
                    'x-producer': this.config.serviceName,
                    'x-publish-time': new Date().toISOString(),
                },
                ...options,
            };
            const buffer = Buffer.from(JSON.stringify(enrichedMessage));
            await this.channel.publish(this.config.rabbitmqExchange, routingKey, buffer, publishOptions);
            const publishTime = Date.now() - startTime;
            this.updateMetrics(publishTime, true);
            this.recordCircuitBreakerSuccess();
            return {
                success: true,
                messageId,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            const publishTime = Date.now() - startTime;
            this.updateMetrics(publishTime, false);
            this.recordCircuitBreakerFailure();
            return {
                success: false,
                messageId,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
    getRoutingKeyForLogLevel(level) {
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
    updateMetrics(publishTime, success) {
        if (success) {
            this.metrics.messagesPublished++;
            this.metrics.messagesConfirmed++;
        }
        else {
            this.metrics.messagesFailed++;
        }
        this.metrics.averagePublishTime =
            (this.metrics.averagePublishTime + publishTime) / 2;
        this.metrics.lastMessageTimestamp = new Date().toISOString();
    }
    async trace(message, context) {
        return this.publishMessage({
            level: types_1.LogLevel.TRACE,
            message,
            context: context || undefined,
        });
    }
    async debug(message, context) {
        return this.publishMessage({
            level: types_1.LogLevel.DEBUG,
            message,
            context: context || undefined,
        });
    }
    async info(message, context) {
        return this.publishMessage({
            level: types_1.LogLevel.INFO,
            message,
            context: context || undefined,
        });
    }
    async warn(message, context) {
        return this.publishMessage({
            level: types_1.LogLevel.WARN,
            message,
            context: context || undefined,
        });
    }
    async error(message, error, context) {
        return this.publishMessage({
            level: types_1.LogLevel.ERROR,
            message,
            context: context || undefined,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack || undefined,
            } : undefined,
        });
    }
    async fatal(message, error, context) {
        return this.publishMessage({
            level: types_1.LogLevel.FATAL,
            message,
            context: context || undefined,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack || undefined,
            } : undefined,
        });
    }
    async businessEvent(event) {
        return this.publishMessage({
            level: types_1.LogLevel.INFO,
            message: `Business Event: ${event.eventType}`,
            metadata: event,
        }, {
            routingKey: 'events.business',
        });
    }
    async securityEvent(event) {
        const level = event.severity === 'critical' || event.severity === 'high'
            ? types_1.LogLevel.ERROR
            : types_1.LogLevel.WARN;
        return this.publishMessage({
            level,
            message: `Security Event: ${event.eventType}`,
            metadata: event,
        }, {
            routingKey: 'events.security',
        });
    }
    async logBatch(messages) {
        const batchId = (0, uuid_1.v4)();
        const results = [];
        for (const message of messages) {
            const result = await this.publishMessage(message);
            results.push(result);
        }
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        return {
            success: failed.length === 0,
            batchId,
            processed: successful.length,
            failed: failed.length,
            timestamp: new Date().toISOString(),
            errors: failed.map((result, index) => ({
                index: results.indexOf(result),
                error: result.error?.message || 'Unknown error',
            })),
        };
    }
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreaker: {
                state: this.circuitBreakerState,
                failures: this.circuitBreakerFailures,
                successes: this.metrics.messagesConfirmed,
                totalRequests: this.metrics.messagesPublished + this.metrics.messagesFailed,
                lastFailureTime: this.circuitBreakerLastFailure,
                nextAttemptTime: this.circuitBreakerState === 'OPEN' && this.circuitBreakerLastFailure
                    ? new Date(this.circuitBreakerLastFailure.getTime() + this.config.circuitBreakerTimeout)
                    : undefined,
            },
        };
    }
    async close() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.isConnected = false;
        this.metrics.connectionStatus = 'disconnected';
    }
}
exports.ObservabilityLogger = ObservabilityLogger;
//# sourceMappingURL=logger.js.map