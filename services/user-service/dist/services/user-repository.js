"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const uuid_1 = require("uuid");
const database_1 = require("@/services/database");
const logger_1 = require("@/bootstrap/logger");
class UserRepository {
    async findAll() {
        try {
            logger_1.logger.debug('Fetching all users', { operation: 'findAll' });
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC');
            logger_1.logger.info('Successfully fetched all users', {
                operation: 'findAll',
                count: result.rows.length
            });
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch users', error, { operation: 'findAll' });
            throw new Error('Failed to fetch users');
        }
    }
    async findById(id) {
        try {
            logger_1.logger.debug('Fetching user by ID', { operation: 'findById', userId: id });
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1', [id]);
            const user = result.rows[0] || null;
            if (user) {
                logger_1.logger.info('Successfully fetched user by ID', {
                    operation: 'findById',
                    userId: id
                });
            }
            else {
                logger_1.logger.warn('User not found by ID', {
                    operation: 'findById',
                    userId: id
                });
            }
            return user;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch user by ID', error, {
                operation: 'findById',
                userId: id
            });
            throw new Error('Failed to fetch user');
        }
    }
    async findByEmail(email) {
        try {
            logger_1.logger.debug('Fetching user by email', { operation: 'findByEmail', email });
            const result = await database_1.db.query('SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1', [email]);
            const user = result.rows[0] || null;
            if (user) {
                logger_1.logger.info('Successfully fetched user by email', {
                    operation: 'findByEmail',
                    email
                });
            }
            else {
                logger_1.logger.debug('User not found by email', {
                    operation: 'findByEmail',
                    email
                });
            }
            return user;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch user by email', error, {
                operation: 'findByEmail',
                email
            });
            throw new Error('Failed to fetch user');
        }
    }
    async create(userData) {
        try {
            logger_1.logger.info('Creating new user', {
                operation: 'create',
                email: userData.email,
                role: userData.role || 'user'
            });
            const id = (0, uuid_1.v4)();
            const role = userData.role || 'user';
            const country = userData.country || null;
            const result = await database_1.db.query('INSERT INTO users (id, name, email, role, country) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"', [id, userData.name, userData.email, role, country]);
            const newUser = result.rows[0];
            logger_1.logger.businessEvent({
                eventType: 'user.created',
                aggregateId: newUser.id,
                aggregateType: 'User',
                eventVersion: 1,
                correlationId: id,
                timestamp: new Date().toISOString(),
                data: newUser,
            });
            logger_1.logger.info('Successfully created user', {
                operation: 'create',
                userId: newUser.id,
                email: newUser.email
            });
            return newUser;
        }
        catch (error) {
            logger_1.logger.error('Failed to create user', error, {
                operation: 'create',
                email: userData.email
            });
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('User with this email already exists');
            }
            throw new Error('Failed to create user');
        }
    }
    async update(id, userData) {
        try {
            logger_1.logger.info('Updating user', {
                operation: 'update',
                userId: id,
                updateFields: Object.keys(userData)
            });
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
            values.push(id);
            const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $${paramIndex} 
        RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"
      `;
            const result = await database_1.db.query(query, values);
            const updatedUser = result.rows[0] || null;
            if (updatedUser) {
                logger_1.logger.businessEvent({
                    eventType: 'user.updated',
                    aggregateId: updatedUser.id,
                    aggregateType: 'User',
                    eventVersion: 1,
                    correlationId: id,
                    timestamp: new Date().toISOString(),
                    data: updatedUser,
                });
                logger_1.logger.info('Successfully updated user', {
                    operation: 'update',
                    userId: id
                });
            }
            else {
                logger_1.logger.warn('User not found for update', {
                    operation: 'update',
                    userId: id
                });
            }
            return updatedUser;
        }
        catch (error) {
            logger_1.logger.error('Failed to update user', error, {
                operation: 'update',
                userId: id
            });
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('User with this email already exists');
            }
            throw new Error('Failed to update user');
        }
    }
    async delete(id) {
        try {
            logger_1.logger.info('Deleting user', { operation: 'delete', userId: id });
            const result = await database_1.db.query('DELETE FROM users WHERE id = $1', [id]);
            const deleted = result.rowCount > 0;
            if (deleted) {
                logger_1.logger.businessEvent({
                    eventType: 'user.deleted',
                    aggregateId: id,
                    aggregateType: 'User',
                    eventVersion: 1,
                    correlationId: id,
                    timestamp: new Date().toISOString(),
                    data: { userId: id },
                });
                logger_1.logger.info('Successfully deleted user', {
                    operation: 'delete',
                    userId: id
                });
            }
            else {
                logger_1.logger.warn('User not found for deletion', {
                    operation: 'delete',
                    userId: id
                });
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error('Failed to delete user', error, {
                operation: 'delete',
                userId: id
            });
            throw new Error('Failed to delete user');
        }
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=user-repository.js.map