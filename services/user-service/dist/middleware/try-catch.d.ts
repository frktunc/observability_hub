import { Request, Response, NextFunction, RequestHandler } from 'express';
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;
export declare const tryCatch: (handler: AsyncRequestHandler) => RequestHandler;
export {};
//# sourceMappingURL=try-catch.d.ts.map