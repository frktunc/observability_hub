import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { logger } from '@/bootstrap/logger';
import { User } from '@/types/user';

export interface CreateUserRequest {
  name: string;
  email: string;
  role?: 'user' | 'admin' | 'moderator';
  country?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'user' | 'admin' | 'moderator';
  country?: string;
}

export class UserRepository {
  async findAll(): Promise<User[]> {
    try {
      logger.debug('Fetching all users', { operation: 'findAll' });
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC'
      );
      logger.info('Successfully fetched all users', { 
        operation: 'findAll',
        count: result.rows.length 
      });
      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch users', error as Error, { operation: 'findAll' });
      throw new Error('Failed to fetch users');
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      logger.debug('Fetching user by ID', { operation: 'findById', userId: id });
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      const user = result.rows[0] || null;
      if (user) {
        logger.info('Successfully fetched user by ID', { 
          operation: 'findById', 
          userId: id 
        });
      } else {
        logger.warn('User not found by ID', { 
          operation: 'findById', 
          userId: id 
        });
      }
      return user;
    } catch (error) {
      logger.error('Failed to fetch user by ID', error as Error, { 
        operation: 'findById', 
        userId: id 
      });
      throw new Error('Failed to fetch user');
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      logger.debug('Fetching user by email', { operation: 'findByEmail', email });
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0] || null;
      if (user) {
        logger.info('Successfully fetched user by email', { 
          operation: 'findByEmail', 
          email 
        });
      } else {
        logger.debug('User not found by email', { 
          operation: 'findByEmail', 
          email 
        });
      }
      return user;
    } catch (error) {
      logger.error('Failed to fetch user by email', error as Error, { 
        operation: 'findByEmail', 
        email 
      });
      throw new Error('Failed to fetch user');
    }
  }

  async create(userData: CreateUserRequest): Promise<User> {
    try {
      logger.info('Creating new user', { 
        operation: 'create', 
        email: userData.email,
        role: userData.role || 'user'
      });
      const id = uuidv4();
      const role = userData.role || 'user';
      const country = userData.country || null;
      const result = await db.query(
        'INSERT INTO users (id, name, email, role, country) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"',
        [id, userData.name, userData.email, role, country]
      );
      const newUser = result.rows[0];
      logger.businessEvent({
        eventType: 'user.created',
        aggregateId: newUser.id,
        aggregateType: 'User',
        eventVersion: 1,
        correlationId: id,
        timestamp: new Date().toISOString(),
        data: newUser,
      });
      logger.info('Successfully created user', { 
        operation: 'create', 
        userId: newUser.id,
        email: newUser.email 
      });
      return newUser;
    } catch (error: any) {
      logger.error('Failed to create user', error as Error, { 
        operation: 'create', 
        email: userData.email 
      });
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      throw new Error('Failed to create user');
    }
  }

  async update(id: string, userData: UpdateUserRequest): Promise<User | null> {
    try {
      logger.info('Updating user', { 
        operation: 'update', 
        userId: id,
        updateFields: Object.keys(userData)
      });
      const updateFields: string[] = [];
      const values: any[] = [];
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

      const result = await db.query(query, values);
      const updatedUser = result.rows[0] || null;
      if (updatedUser) {
        logger.businessEvent({
          eventType: 'user.updated',
          aggregateId: updatedUser.id,
          aggregateType: 'User',
          eventVersion: 1,
          correlationId: id,
          timestamp: new Date().toISOString(),
          data: updatedUser,
        });
        logger.info('Successfully updated user', { 
          operation: 'update', 
          userId: id 
        });
      } else {
        logger.warn('User not found for update', { 
          operation: 'update', 
          userId: id 
        });
      }
      return updatedUser;
    } catch (error: any) {
      logger.error('Failed to update user', error as Error, { 
        operation: 'update', 
        userId: id 
      });
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      throw new Error('Failed to update user');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      logger.info('Deleting user', { operation: 'delete', userId: id });
      const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.businessEvent({
          eventType: 'user.deleted',
          aggregateId: id,
          aggregateType: 'User',
          eventVersion: 1,
          correlationId: id,
          timestamp: new Date().toISOString(),
          data: { userId: id },
        });
        logger.info('Successfully deleted user', { 
          operation: 'delete', 
          userId: id 
        });
      } else {
        logger.warn('User not found for deletion', { 
          operation: 'delete', 
          userId: id 
        });
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to delete user', error as Error, { 
        operation: 'delete', 
        userId: id 
      });
      throw new Error('Failed to delete user');
    }
  }
}

export const userRepository = new UserRepository();
