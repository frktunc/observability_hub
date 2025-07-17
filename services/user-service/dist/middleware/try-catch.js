"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryCatch = void 0;
const tryCatch = (handler) => async (req, res, next) => {
    try {
        await handler(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
exports.tryCatch = tryCatch;
//# sourceMappingURL=try-catch.js.map