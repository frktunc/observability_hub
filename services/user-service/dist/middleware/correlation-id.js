"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
const uuid_1 = require("uuid");
function correlationIdMiddleware(req, res, next) {
    // Get correlation ID from headers or generate new one
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    // Add to request object
    req.correlationId = correlationId;
    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);
    next();
}
//# sourceMappingURL=correlation-id.js.map