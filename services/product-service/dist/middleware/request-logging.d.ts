import { Request, Response, NextFunction } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';
export declare const requestLoggingMiddleware: (logger: ObservabilityLogger) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=request-logging.d.ts.map