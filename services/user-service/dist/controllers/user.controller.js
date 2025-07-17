"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = exports.createUser = exports.getUsers = void 0;
const user_service_1 = require("@/services/user.service");
const user_repository_1 = require("@/services/user-repository");
const userService = new user_service_1.UserService(user_repository_1.userRepository);
const getUsers = async (req, res) => {
    const users = await userService.getUsers();
    res.json({ success: true, data: users });
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    const user = await userService.createUser(req.body);
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