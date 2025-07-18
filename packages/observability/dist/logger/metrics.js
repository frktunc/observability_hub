"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialMetrics = createInitialMetrics;
exports.updateMetrics = updateMetrics;
exports.getFullMetrics = getFullMetrics;
function createInitialMetrics() {
    return {
        messagesPublished: 0,
        messagesFailed: 0,
        messagesConfirmed: 0,
        connectionStatus: 'disconnected',
        averagePublishTime: 0,
    };
}
function updateMetrics(metrics, publishTime, success) {
    const newMetrics = { ...metrics };
    if (success) {
        newMetrics.messagesPublished++;
        newMetrics.messagesConfirmed++;
    }
    else {
        newMetrics.messagesFailed++;
    }
    // Update average publish time using a simple moving average
    newMetrics.averagePublishTime =
        (newMetrics.averagePublishTime * (newMetrics.messagesPublished - 1) + publishTime) / newMetrics.messagesPublished;
    newMetrics.lastMessageTimestamp = new Date().toISOString();
    return newMetrics;
}
function getFullMetrics(metrics, circuitBreakerState, circuitBreakerFailures, circuitBreakerLastFailure, circuitBreakerTimeout) {
    return {
        ...metrics,
        circuitBreaker: {
            state: circuitBreakerState,
            failures: circuitBreakerFailures,
            successes: metrics.messagesConfirmed,
            totalRequests: metrics.messagesPublished + metrics.messagesFailed,
            lastFailureTime: circuitBreakerLastFailure,
            nextAttemptTime: circuitBreakerState === 'OPEN' && circuitBreakerLastFailure && circuitBreakerTimeout
                ? new Date(circuitBreakerLastFailure.getTime() + circuitBreakerTimeout)
                : undefined,
        },
    };
}
//# sourceMappingURL=metrics.js.map