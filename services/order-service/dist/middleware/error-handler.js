"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerMiddleware = void 0;
const errorHandlerMiddleware = (error, req, res, next) => {
    const correlationId = req.correlationId || 'unknown';
    console.error(`[${correlationId}] Error:`, error);
    let statusCode = 500;
    if (error.name === 'ValidationError')
        statusCode = 400;
    else if (error.name === 'NotFoundError')
        statusCode = 404;
    else if (error.name === 'UnauthorizedError')
        statusCode = 401;
    else if (error.name === 'ForbiddenError')
        statusCode = 403;
    res.status(statusCode).json({
        error: {
            message: error.message || 'Internal Server Error',
            type: error.name || 'Error',
            correlationId,
            timestamp: new Date().toISOString()
        }
    });
};
exports.errorHandlerMiddleware = errorHandlerMiddleware;
//# sourceMappingURL=error-handler.js.map