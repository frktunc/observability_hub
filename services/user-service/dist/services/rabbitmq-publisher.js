"use strict";
// import amqp, { Connection, Channel, ConfirmChannel } from 'amqplib';
// import { EventEmitter } from 'events';
// import retry from 'async-retry';
// import CircuitBreaker from 'opossum';
Object.defineProperty(exports, "__esModule", { value: true });
exports.rabbitMQPublisher = exports.RabbitMQPublisher = void 0;
const retry = async (fn, options) => fn();
const CircuitBreaker = class {
    constructor(fn, options) { this.fire = fn; this.stats = { state: 'CLOSED' }; }
    fire;
    stats;
    on = () => { };
};
const config_1 = require("@/config");
const logger_1 = require("@/services/logger");
const events_1 = require("@/types/events");
class RabbitMQPublisher {
    connection = null;
    channels = new Map();
    isConnecting = false;
    reconnectTimer = null;
    circuitBreaker;
    metrics;
    publishTimes = [];
    constructor() {
        this.metrics = {
            isConnected: false,
            connectionCount: 0,
            channelCount: 0,
            messagesPublished: 0,
            messagesConfirmed: 0,
            messagesFailed: 0,
            reconnectAttempts: 0,
            averagePublishTime: 0,
        };
        // Setup circuit breaker for publish operations
        this.circuitBreaker = new CircuitBreaker(this.publishToRabbitMQ.bind(this), {
            timeout: config_1.config.CIRCUIT_BREAKER_TIMEOUT,
            errorThresholdPercentage: config_1.config.CIRCUIT_BREAKER_ERROR_THRESHOLD,
            resetTimeout: config_1.config.CIRCUIT_BREAKER_RESET_TIMEOUT,
            name: 'rabbitmq-publisher',
        });
        this.setupCircuitBreakerEvents();
    }
    setupCircuitBreakerEvents() {
        this.circuitBreaker.on('open', () => {
            logger_1.structuredLogger.error('Circuit breaker opened - RabbitMQ publish operations halted', {
                component: 'rabbitmq-publisher',
                circuitBreakerState: 'open',
            });
            // this.emit('circuit-breaker-open');
        });
        this.circuitBreaker.on('halfOpen', () => {
            logger_1.structuredLogger.warn('Circuit breaker half-open - testing RabbitMQ connectivity', {
                component: 'rabbitmq-publisher',
                circuitBreakerState: 'half-open',
            });
            // this.emit('circuit-breaker-half-open');
        });
        this.circuitBreaker.on('close', () => {
            logger_1.structuredLogger.info('Circuit breaker closed - RabbitMQ publish operations resumed', {
                component: 'rabbitmq-publisher',
                circuitBreakerState: 'closed',
            });
            // this.emit('circuit-breaker-close');
        });
    }
    async initialize() {
        logger_1.structuredLogger.info('Initializing RabbitMQ publisher', {
            component: 'rabbitmq-publisher',
            rabbitmqUrl: config_1.derivedConfig.rabbitmq.url.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
        });
        await this.connect();
        await this.createChannels();
        logger_1.structuredLogger.info('RabbitMQ publisher initialized successfully', {
            component: 'rabbitmq-publisher',
            connectionStatus: this.metrics.isConnected,
            channelCount: this.metrics.channelCount,
        });
    }
    async connect() {
        if (this.isConnecting || this.connection) {
            return;
        }
        this.isConnecting = true;
        try {
            await retry(async () => {
                this.connection = await amqp.connect(config_1.derivedConfig.rabbitmq.url, config_1.derivedConfig.rabbitmq.connectionOptions);
                this.setupConnectionEvents();
                this.metrics.isConnected = true;
                this.metrics.connectionCount++;
                logger_1.structuredLogger.info('Connected to RabbitMQ', {
                    component: 'rabbitmq-publisher',
                    connectionCount: this.metrics.connectionCount,
                });
            }, {
                retries: config_1.derivedConfig.rabbitmq.retryOptions.maxRetries,
                minTimeout: config_1.derivedConfig.rabbitmq.retryOptions.retryDelayMs,
                maxTimeout: config_1.derivedConfig.rabbitmq.retryOptions.retryDelayMs * 5,
                onRetry: (error, attempt) => {
                    this.metrics.reconnectAttempts++;
                    logger_1.structuredLogger.warn('RabbitMQ connection attempt failed', {
                        component: 'rabbitmq-publisher',
                        attempt,
                        error: error.message,
                        nextRetryIn: config_1.derivedConfig.rabbitmq.retryOptions.retryDelayMs,
                    });
                },
            });
        }
        catch (error) {
            this.isConnecting = false;
            this.metrics.isConnected = false;
            logger_1.structuredLogger.error('Failed to connect to RabbitMQ after all retries', {
                component: 'rabbitmq-publisher',
                error: error instanceof Error ? error.message : String(error),
                reconnectAttempts: this.metrics.reconnectAttempts,
            });
            this.scheduleReconnect();
            throw error;
        }
        finally {
            this.isConnecting = false;
        }
    }
    setupConnectionEvents() {
        if (!this.connection)
            return;
        this.connection.on('error', (error) => {
            logger_1.structuredLogger.error('RabbitMQ connection error', {
                component: 'rabbitmq-publisher',
                error: error.message,
            });
            this.handleConnectionLoss();
        });
        this.connection.on('close', () => {
            logger_1.structuredLogger.warn('RabbitMQ connection closed', {
                component: 'rabbitmq-publisher',
            });
            this.handleConnectionLoss();
        });
        this.connection.on('blocked', (reason) => {
            logger_1.structuredLogger.warn('RabbitMQ connection blocked', {
                component: 'rabbitmq-publisher',
                reason,
            });
        });
        this.connection.on('unblocked', () => {
            logger_1.structuredLogger.info('RabbitMQ connection unblocked', {
                component: 'rabbitmq-publisher',
            });
        });
    }
    handleConnectionLoss() {
        this.connection = null;
        this.channels.clear();
        this.metrics.isConnected = false;
        this.metrics.channelCount = 0;
        // this.emit('connection-lost');
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
                await this.createChannels();
                // this.emit('reconnected');
            }
            catch (error) {
                // Will be scheduled again by handleConnectionLoss
            }
        }, config_1.derivedConfig.rabbitmq.retryOptions.retryDelayMs);
        this.metrics.lastReconnectTime = new Date();
    }
    async createChannels() {
        if (!this.connection) {
            throw new Error('No RabbitMQ connection available');
        }
        const channelNames = ['default', 'priority', 'batch'];
        for (const channelName of channelNames) {
            try {
                const channel = await this.connection.createConfirmChannel();
                // Set channel prefetch for better performance
                await channel.prefetch(100);
                // Assert exchange exists
                await channel.assertExchange(config_1.derivedConfig.rabbitmq.exchange, 'topic', { durable: true });
                this.channels.set(channelName, channel);
                this.metrics.channelCount++;
                logger_1.structuredLogger.debug('Created RabbitMQ channel', {
                    component: 'rabbitmq-publisher',
                    channelName,
                    channelCount: this.metrics.channelCount,
                });
            }
            catch (error) {
                logger_1.structuredLogger.error('Failed to create RabbitMQ channel', {
                    component: 'rabbitmq-publisher',
                    channelName,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        }
    }
    getRoutingKeyForLogLevel(level) {
        switch (level) {
            case events_1.LogLevel.ERROR:
            case events_1.LogLevel.FATAL:
                return config_1.derivedConfig.rabbitmq.routingKeys.error;
            case events_1.LogLevel.WARN:
                return config_1.derivedConfig.rabbitmq.routingKeys.warning;
            case events_1.LogLevel.INFO:
                return config_1.derivedConfig.rabbitmq.routingKeys.info;
            case events_1.LogLevel.DEBUG:
            case events_1.LogLevel.TRACE:
                return config_1.derivedConfig.rabbitmq.routingKeys.debug;
            default:
                return config_1.derivedConfig.rabbitmq.routingKeys.info;
        }
    }
    async publishToRabbitMQ(message, options = {}) {
        const startTime = Date.now();
        const messageId = options.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (!this.connection || this.channels.size === 0) {
            throw new Error('No RabbitMQ connection or channels available');
        }
        const channel = this.channels.get('default');
        if (!channel) {
            throw new Error('Default channel not available');
        }
        const routingKey = options.routingKey || 'logs.info';
        const buffer = Buffer.from(JSON.stringify(message));
        const publishOptions = {
            persistent: options.persistent ?? true,
            messageId,
            timestamp: Date.now(),
            correlationId: options.correlationId,
            headers: {
                ...options.headers,
                'x-publish-time': new Date().toISOString(),
                'x-producer': config_1.config.SERVICE_NAME,
            },
            expiration: options.expiration,
            priority: options.priority,
            replyTo: options.replyTo,
        };
        return new Promise((resolve, reject) => {
            channel.publish(config_1.derivedConfig.rabbitmq.exchange, routingKey, buffer, publishOptions, (error, ok) => {
                const publishTime = Date.now() - startTime;
                this.updateMetrics(publishTime, !error);
                if (error) {
                    this.metrics.messagesFailed++;
                    logger_1.structuredLogger.error('Failed to publish message to RabbitMQ', {
                        component: 'rabbitmq-publisher',
                        messageId,
                        routingKey,
                        error: error.message,
                        publishTime,
                    });
                    reject(error);
                }
                else {
                    this.metrics.messagesPublished++;
                    this.metrics.messagesConfirmed++;
                    logger_1.structuredLogger.debug('Message published to RabbitMQ', {
                        component: 'rabbitmq-publisher',
                        messageId,
                        routingKey,
                        publishTime,
                    });
                    resolve({
                        success: true,
                        messageId,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        });
    }
    updateMetrics(publishTime, success) {
        this.publishTimes.push(publishTime);
        // Keep only last 1000 measurements for average calculation
        if (this.publishTimes.length > 1000) {
            this.publishTimes = this.publishTimes.slice(-1000);
        }
        this.metrics.averagePublishTime =
            this.publishTimes.reduce((sum, time) => sum + time, 0) / this.publishTimes.length;
        if (!success) {
            this.metrics.messagesFailed++;
        }
    }
    // Public API methods
    async publishLog(message, options = {}) {
        const routingKey = options.routingKey || this.getRoutingKeyForLogLevel(message.level);
        const publishOptions = {
            ...options,
            routingKey,
            correlationId: message.correlationId || options.correlationId,
        };
        try {
            return await this.circuitBreaker.fire(message, publishOptions);
        }
        catch (error) {
            logger_1.structuredLogger.error('Circuit breaker rejected publish operation', {
                component: 'rabbitmq-publisher',
                circuitBreakerState: this.circuitBreaker.stats.state,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                messageId: publishOptions.messageId || 'unknown',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
    async publishBatch(messages, batchOptions = {}) {
        if (!config_1.config.FEATURE_BATCH_PROCESSING) {
            // Fallback to individual publishing
            const results = [];
            for (const message of messages) {
                results.push(await this.publishLog(message, batchOptions));
            }
            return results;
        }
        const results = [];
        const channel = this.channels.get('batch');
        if (!channel) {
            throw new Error('Batch channel not available');
        }
        try {
            // Use transaction for batch publishing
            await channel.txSelect();
            for (const message of messages) {
                try {
                    const result = await this.publishLog(message, batchOptions);
                    results.push(result);
                }
                catch (error) {
                    results.push({
                        success: false,
                        messageId: 'batch-failed',
                        timestamp: new Date().toISOString(),
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            }
            await channel.txCommit();
            logger_1.structuredLogger.info('Batch publish completed', {
                component: 'rabbitmq-publisher',
                batchSize: messages.length,
                successCount: results.filter(r => r.success).length,
                failureCount: results.filter(r => !r.success).length,
            });
        }
        catch (error) {
            await channel.txRollback();
            logger_1.structuredLogger.error('Batch publish failed - transaction rolled back', {
                component: 'rabbitmq-publisher',
                batchSize: messages.length,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        return results;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    isHealthy() {
        return this.metrics.isConnected &&
            this.channels.size > 0 &&
            this.circuitBreaker.stats.state === 'CLOSED';
    }
    async shutdown() {
        logger_1.structuredLogger.info('Shutting down RabbitMQ publisher', {
            component: 'rabbitmq-publisher',
        });
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // Close all channels
        for (const [name, channel] of this.channels) {
            try {
                await channel.close();
                logger_1.structuredLogger.debug('Closed RabbitMQ channel', {
                    component: 'rabbitmq-publisher',
                    channelName: name,
                });
            }
            catch (error) {
                logger_1.structuredLogger.warn('Error closing RabbitMQ channel', {
                    component: 'rabbitmq-publisher',
                    channelName: name,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        this.channels.clear();
        // Close connection
        if (this.connection) {
            try {
                await this.connection.close();
                logger_1.structuredLogger.info('RabbitMQ connection closed', {
                    component: 'rabbitmq-publisher',
                });
            }
            catch (error) {
                logger_1.structuredLogger.warn('Error closing RabbitMQ connection', {
                    component: 'rabbitmq-publisher',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        this.connection = null;
        this.metrics.isConnected = false;
        this.metrics.channelCount = 0;
    }
}
exports.RabbitMQPublisher = RabbitMQPublisher;
// Export singleton instance
exports.rabbitMQPublisher = new RabbitMQPublisher();
//# sourceMappingURL=rabbitmq-publisher.js.map