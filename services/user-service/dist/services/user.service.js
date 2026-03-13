"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
class UserService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    getUsers() {
        return this.repository.getUsers();
    }
    createUser(user) {
        return this.repository.createUser(user);
    }
    getUserById(id) {
        return this.repository.getUserById(id);
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map