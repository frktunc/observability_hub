import express from 'express';
export declare function createApp(): express.Application;
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
            requestId?: string;
            tenantId?: string;
            startTime?: number;
            rawBody?: Buffer;
        }
    }
}
//# sourceMappingURL=app.d.ts.map