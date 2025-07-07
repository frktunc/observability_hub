"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = void 0;
const requestLoggingMiddleware = (logger) => {
    return (req, res, next) => {
        const startTime = Date.now();
        const correlationId = req.correlationId || 'unknown';
        logger.info('Incoming request', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            correlationId
        });
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            const duration = Date.now() - startTime;
            logger.info('Request completed', {
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                correlationId
            });
            return originalEnd.call(this, chunk, encoding);
        };
        next();
    };
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
//# sourceMappingURL=request-logging.js.map