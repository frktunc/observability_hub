"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCircuitBreaker = createCircuitBreaker;
function createCircuitBreaker(threshold, timeout) {
    let state = 'CLOSED';
    let failures = 0;
    let lastFailure;
    function isRequestAllowed() {
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
    function recordSuccess() {
        if (state === 'HALF_OPEN') {
            state = 'CLOSED';
            failures = 0;
        }
    }
    function recordFailure() {
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
//# sourceMappingURL=circuit-breaker.js.map