import { CircuitBreakerState } from './types';

export interface CircuitBreaker {
  state: CircuitBreakerState;
  failures: number;
  lastFailure?: Date;
  isRequestAllowed(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

export function createCircuitBreaker(
  threshold: number,
  timeout: number
): CircuitBreaker {
  let state: CircuitBreakerState = 'CLOSED';
  let failures = 0;
  let lastFailure: Date | undefined;

  function isRequestAllowed(): boolean {
    if (state === 'OPEN') {
      const timeSinceLastFailure = lastFailure
        ? Date.now() - lastFailure.getTime()
        : 0;
      
      if (timeSinceLastFailure > timeout) {
        state = 'HALF_OPEN';
        failures = 0;
      }
    }
    
    return state !== 'OPEN';
  }

  function recordSuccess(): void {
    if (state === 'HALF_OPEN') {
      state = 'CLOSED';
      failures = 0;
    }
  }

  function recordFailure(): void {
    failures++;
    lastFailure = new Date();
    
    if (failures >= threshold) {
      state = 'OPEN';
    }
  }

  return {
    get state() {
      return state;
    },
    get failures() {
      return failures;
    },
    get lastFailure() {
      return lastFailure;
    },
    isRequestAllowed,
    recordSuccess,
    recordFailure,
  };
}
