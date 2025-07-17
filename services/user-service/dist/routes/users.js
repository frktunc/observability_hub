"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const user_controller_1 = require("@/controllers/user.controller");
const try_catch_1 = require("@/middleware/try-catch");
const router = (0, express_1.Router)();
exports.userRoutes = router;
router.get('/', (0, try_catch_1.tryCatch)(user_controller_1.getUsers));
router.post('/', (0, try_catch_1.tryCatch)(user_controller_1.createUser));
router.get('/:id', (0, try_catch_1.tryCatch)(user_controller_1.getUserById));
//# sourceMappingURL=users.js.map