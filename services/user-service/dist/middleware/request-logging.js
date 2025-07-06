"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = requestLoggingMiddleware;
function requestLoggingMiddleware(req, res, next) {
    // Add start time to request
    req.startTime = Date.now();
    // Log request start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - (req.startTime || 0);
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
}
//# sourceMappingURL=request-logging.js.map