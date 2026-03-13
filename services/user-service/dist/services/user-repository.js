"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const database_1 = require("@/services/database");
class UserRepository {
    async getUsers() {
        const result = await database_1.db.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows;
    }
    async createUser(user) {
        const { name, email, role, country } = user;
        const result = await database_1.db.query('INSERT INTO users (name, email, role, country) VALUES ($1, $2, $3, $4) RETURNING *', [name, email, role || 'user', country]);
        return result.rows[0];
    }
    async getUserById(id) {
        const result = await database_1.db.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=user-repository.js.map