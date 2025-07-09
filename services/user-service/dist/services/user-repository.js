"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
class UserRepository {
    async getAllUsers() {
        try {
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC');
            return result.rows;
        }
        catch (error) {
            console.error('Error fetching users:', error);
            throw new Error('Failed to fetch users');
        }
    }
    async getUserById(id) {
        try {
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1', [id]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user');
        }
    }
    async getUserByEmail(email) {
        try {
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1', [email]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error fetching user by email:', error);
            throw new Error('Failed to fetch user');
        }
    }
    async createUser(userData) {
        try {
            const id = (0, uuid_1.v4)();
            const role = userData.role || 'user';
            const country = userData.country || null;
            const result = await database_1.db.query('INSERT INTO users (id, name, email, role, country) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"', [id, userData.name, userData.email, role, country]);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error creating user:', error);
            // Handle unique constraint violation (duplicate email)
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('User with this email already exists');
            }
            throw new Error('Failed to create user');
        }
    }
    async updateUser(id, userData) {
        try {
            // Build dynamic update query
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            if (userData.name !== undefined) {
                updateFields.push(`name = $${paramIndex++}`);
                values.push(userData.name);
            }
            if (userData.email !== undefined) {
                updateFields.push(`email = $${paramIndex++}`);
                values.push(userData.email);
            }
            if (userData.role !== undefined) {
                updateFields.push(`role = $${paramIndex++}`);
                values.push(userData.role);
            }
            if (userData.country !== undefined) {
                updateFields.push(`country = $${paramIndex++}`);
                values.push(userData.country);
            }
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }
            // Add id to the end
            values.push(id);
            const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $${paramIndex} 
        RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"
      `;
            const result = await database_1.db.query(query, values);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error updating user:', error);
            // Handle unique constraint violation (duplicate email)
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('User with this email already exists');
            }
            throw new Error('Failed to update user');
        }
    }
    async deleteUser(id) {
        try {
            const result = await database_1.db.query('DELETE FROM users WHERE id = $1', [id]);
            return result.rowCount > 0;
        }
        catch (error) {
            console.error('Error deleting user:', error);
            throw new Error('Failed to delete user');
        }
    }
    async getUsersCount() {
        try {
            const result = await database_1.db.query('SELECT COUNT(*) as count FROM users');
            return parseInt(result.rows[0].count, 10);
        }
        catch (error) {
            console.error('Error counting users:', error);
            throw new Error('Failed to count users');
        }
    }
    async getUsersByRole(role) {
        try {
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE role = $1 ORDER BY created_at DESC', [role]);
            return result.rows;
        }
        catch (error) {
            console.error('Error fetching users by role:', error);
            throw new Error('Failed to fetch users by role');
        }
    }
    async getUsersByCountry(country) {
        try {
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE country = $1 ORDER BY created_at DESC', [country]);
            return result.rows;
        }
        catch (error) {
            console.error('Error fetching users by country:', error);
            throw new Error('Failed to fetch users by country');
        }
    }
    async getCountryStats() {
        try {
            const result = await database_1.db.query('SELECT country, COUNT(*) as "userCount" FROM users WHERE country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC');
            return result.rows;
        }
        catch (error) {
            console.error('Error fetching country stats:', error);
            throw new Error('Failed to fetch country stats');
        }
    }
}
exports.UserRepository = UserRepository;
// Create singleton instance
exports.userRepository = new UserRepository();
//# sourceMappingURL=user-repository.js.map