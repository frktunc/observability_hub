"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRabbitMQConnection = createRabbitMQConnection;
const amqplib_1 = require("amqplib");
function createRabbitMQConnection(config, onReconnect) {
    let connection = null;
    let channel = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    async function connectToRabbitMQ() {
        try {
            const { rabbitmqHostname, rabbitmqPort, rabbitmqUsername, rabbitmqPassword, rabbitmqVhost, heartbeat, connectionTimeout, } = config;
            const connOptions = {
                protocol: 'amqp',
                hostname: rabbitmqHostname,
                port: rabbitmqPort,
                username: rabbitmqUsername,
                password: rabbitmqPassword,
                vhost: rabbitmqVhost,
                heartbeat,
                timeout: connectionTimeout,
            };
            connection = await (0, amqplib_1.connect)(connOptions);
            channel = await connection.createChannel();
            if (channel) {
                await channel.assertExchange(config.rabbitmqExchange, 'topic', {
                    durable: true,
                });
            }
            isConnected = true;
            reconnectAttempts = 0;
            connection.on('error', handleConnectionError);
            connection.on('close', handleConnectionClose);
            console.log(`[ObservabilityLogger] Connected to RabbitMQ: ${config.serviceName}`);
        }
        catch (error) {
            console.error('[ObservabilityLogger] Connection failed:', error);
            isConnected = false;
            if (reconnectAttempts < config.maxRetries) {
                reconnectAttempts++;
                setTimeout(connectToRabbitMQ, config.retryDelayMs * reconnectAttempts);
            }
        }
    }
    function handleConnectionError(error) {
        console.error('[ObservabilityLogger] Connection error:', error);
        isConnected = false;
    }
    function handleConnectionClose() {
        console.log('[ObservabilityLogger] Connection closed, attempting to reconnect...');
        isConnected = false;
        onReconnect();
    }
    async function close() {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
        isConnected = false;
    }
    return {
        get connection() {
            return connection;
        },
        get channel() {
            return channel;
        },
        get isConnected() {
            return isConnected;
        },
        connect: connectToRabbitMQ,
        close,
    };
}
//# sourceMappingURL=connection.js.map