"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
class UserService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async getUsers() {
        return this.userRepository.findAll();
    }
    async createUser(userData) {
        return this.userRepository.create(userData);
    }
    async getUserById(id) {
        return this.userRepository.findById(id);
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map