import { ClientMetrics, CircuitBreakerState } from './types';

export function createInitialMetrics(): ClientMetrics {
  return {
    messagesPublished: 0,
    messagesFailed: 0,
    messagesConfirmed: 0,
    connectionStatus: 'disconnected',
    averagePublishTime: 0,
  };
}

export function updateMetrics(
  metrics: ClientMetrics,
  publishTime: number,
  success: boolean
): ClientMetrics {
  const newMetrics = { ...metrics };
  if (success) {
    newMetrics.messagesPublished++;
    newMetrics.messagesConfirmed++;
  } else {
    newMetrics.messagesFailed++;
  }

  // Update average publish time using a simple moving average
  newMetrics.averagePublishTime =
    (newMetrics.averagePublishTime * (newMetrics.messagesPublished - 1) + publishTime) / newMetrics.messagesPublished;
  
  newMetrics.lastMessageTimestamp = new Date().toISOString();
  return newMetrics;
}

export function getFullMetrics(
  metrics: ClientMetrics,
  circuitBreakerState: CircuitBreakerState,
  circuitBreakerFailures: number,
  circuitBreakerLastFailure?: Date,
  circuitBreakerTimeout?: number
) {
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
