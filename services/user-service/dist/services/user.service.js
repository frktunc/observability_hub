"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
class UserService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getUsers() {
        return this.repository.findAll();
    }
    async getUserById(id) {
        return this.repository.findById(id);
    }
    async createUser(userData) {
        // Here you could add business logic, validation, etc.
        return this.repository.create(userData);
    }
    async updateUser(id, userData) {
        // Add business logic before updating
        return this.repository.update(id, userData);
    }
    async deleteUser(id) {
        return this.repository.delete(id);
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map