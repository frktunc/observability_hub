"use strict";
/**
 * Main exports for @observability-hub/event-contracts
 * TypeScript types and validators for observability events
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_VERSIONS = exports.VERSION = exports.resetGlobalValidator = exports.validateEvents = exports.validateEvent = exports.getValidator = exports.EventValidator = void 0;
// Type exports
__exportStar(require("./types/base"), exports);
__exportStar(require("./types/log"), exports);
__exportStar(require("./types/metrics"), exports);
__exportStar(require("./types/trace"), exports);
// Validator exports
__exportStar(require("./validators/schema-validator"), exports);
__exportStar(require("./validators/simple-validator"), exports);
// Re-export main validator for convenience
var schema_validator_1 = require("./validators/schema-validator");
Object.defineProperty(exports, "EventValidator", { enumerable: true, get: function () { return schema_validator_1.EventValidator; } });
Object.defineProperty(exports, "getValidator", { enumerable: true, get: function () { return schema_validator_1.getValidator; } });
Object.defineProperty(exports, "validateEvent", { enumerable: true, get: function () { return schema_validator_1.validateEvent; } });
Object.defineProperty(exports, "validateEvents", { enumerable: true, get: function () { return schema_validator_1.validateEvents; } });
Object.defineProperty(exports, "resetGlobalValidator", { enumerable: true, get: function () { return schema_validator_1.resetGlobalValidator; } });
// Version information
exports.VERSION = '1.0.0';
exports.SCHEMA_VERSIONS = {
    BASE_EVENT: '1.0.0',
    LOG_EVENT: '1.0.0',
    METRICS_EVENT: '1.0.0',
    TRACE_EVENT: '1.0.0',
};
//# sourceMappingURL=index.js.map