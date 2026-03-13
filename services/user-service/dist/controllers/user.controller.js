"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = exports.createUser = exports.getUsers = void 0;
const zod_1 = require("zod");
const user_service_js_1 = require("../services/user.service.js");
const user_repository_js_1 = require("../services/user-repository.js");
const userService = new user_service_js_1.UserService(user_repository_js_1.userRepository);
const createUserBodySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: zod_1.z.string().email().optional(),
});
const getUsers = async (req, res) => {
    const users = await userService.getUsers();
    res.json({ success: true, data: users });
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    const parsed = createUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    const user = await userService.createUser(parsed.data);
    res.status(201).json({ success: true, data: user });
};
exports.createUser = createUser;
const getUserById = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ success: false, message: 'User ID is required' });
        return;
    }
    const user = await userService.getUserById(id);
    if (user) {
        res.json({ success: true, data: user });
    }
    else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
};
exports.getUserById = getUserById;
//# sourceMappingURL=user.controller.js.map