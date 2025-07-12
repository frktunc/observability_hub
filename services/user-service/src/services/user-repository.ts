import { v4 as uuidv4 } from 'uuid';
import { ObservabilityLogger } from '@observability-hub/observability';
import { db } from './database';
import { config } from '../config';

export interface User extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  country?: string; // ISO 3166-1 alpha-3 country code (TUR, USA, etc.)
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role?: string;
  country?: string; // ISO 3166-1 alpha-3 country code
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  country?: string; // ISO 3166-1 alpha-3 country code
}

export class UserRepository {
  private logger: ObservabilityLogger;

  constructor() {
    this.logger = new ObservabilityLogger({
      serviceName: config.SERVICE_NAME,
      serviceVersion: config.SERVICE_VERSION,
      environment: config.NODE_ENV,
      defaultLogLevel: config.LOG_LEVEL as any,
    });
  }

  async getAllUsers(): Promise<User[]> {
    try {
      this.logger.debug('Fetching all users', { operation: 'getAllUsers' });
      
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC'
      );
      
      this.logger.info('Successfully fetched all users', { 
        operation: 'getAllUsers',
        count: result.rows.length 
      });
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch users', error as Error, { operation: 'getAllUsers' });
      throw new Error('Failed to fetch users');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      this.logger.debug('Fetching user by ID', { operation: 'getUserById', userId: id });
      
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      
      const user = result.rows[0] || null;
      
      if (user) {
        this.logger.info('Successfully fetched user by ID', { 
          operation: 'getUserById', 
          userId: id 
        });
      } else {
        this.logger.warn('User not found by ID', { 
          operation: 'getUserById', 
          userId: id 
        });
      }
      
      return user;
    } catch (error) {
      this.logger.error('Failed to fetch user by ID', error as Error, { 
        operation: 'getUserById', 
        userId: id 
      });
      throw new Error('Failed to fetch user');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      this.logger.debug('Fetching user by email', { operation: 'getUserByEmail', email });
      
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1',
        [email]
      );
      
      const user = result.rows[0] || null;
      
      if (user) {
        this.logger.info('Successfully fetched user by email', { 
          operation: 'getUserByEmail', 
          email 
        });
      } else {
        this.logger.debug('User not found by email', { 
          operation: 'getUserByEmail', 
          email 
        });
      }
      
      return user;
    } catch (error) {
      this.logger.error('Failed to fetch user by email', error as Error, { 
        operation: 'getUserByEmail', 
        email 
      });
      throw new Error('Failed to fetch user');
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      this.logger.info('Creating new user', { 
        operation: 'createUser', 
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
      
      this.logger.businessEvent({
        eventType: 'user.created',
        aggregateId: newUser.id,
        aggregateType: 'User',
        eventVersion: 1,
        correlationId: id,
        timestamp: new Date().toISOString(),
        data: newUser,
      });
      
      this.logger.info('Successfully created user', { 
        operation: 'createUser', 
        userId: newUser.id,
        email: newUser.email 
      });
      
      return newUser;
    } catch (error: any) {
      this.logger.error('Failed to create user', error as Error, { 
        operation: 'createUser', 
        email: userData.email 
      });
      
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User | null> {
    try {
      this.logger.info('Updating user', { 
        operation: 'updateUser', 
        userId: id,
        updateFields: Object.keys(userData)
      });
      
      // Build dynamic update query
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

      // Add id to the end
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
        this.logger.businessEvent({
          eventType: 'user.updated',
          aggregateId: updatedUser.id,
          aggregateType: 'User',
          eventVersion: 1,
          correlationId: id,
          timestamp: new Date().toISOString(),
          data: updatedUser,
        });
        
        this.logger.info('Successfully updated user', { 
          operation: 'updateUser', 
          userId: id 
        });
      } else {
        this.logger.warn('User not found for update', { 
          operation: 'updateUser', 
          userId: id 
        });
      }
      
      return updatedUser;
    } catch (error: any) {
      this.logger.error('Failed to update user', error as Error, { 
        operation: 'updateUser', 
        userId: id 
      });
      
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      this.logger.info('Deleting user', { operation: 'deleteUser', userId: id });
      
      const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        this.logger.businessEvent({
          eventType: 'user.deleted',
          aggregateId: id,
          aggregateType: 'User',
          eventVersion: 1,
          correlationId: id,
          timestamp: new Date().toISOString(),
          data: { userId: id },
        });
        
        this.logger.info('Successfully deleted user', { 
          operation: 'deleteUser', 
          userId: id 
        });
      } else {
        this.logger.warn('User not found for deletion', { 
          operation: 'deleteUser', 
          userId: id 
        });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete user', error as Error, { 
        operation: 'deleteUser', 
        userId: id 
      });
      throw new Error('Failed to delete user');
    }
  }

  async getUsersCount(): Promise<number> {
    try {
      this.logger.debug('Counting users', { operation: 'getUsersCount' });
      
      const result = await db.query('SELECT COUNT(*) as count FROM users');
      const count = parseInt(result.rows[0].count, 10);
      
      this.logger.info('Successfully counted users', { 
        operation: 'getUsersCount', 
        count 
      });
      
      return count;
    } catch (error) {
      this.logger.error('Failed to count users', error as Error, { operation: 'getUsersCount' });
      throw new Error('Failed to count users');
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    try {
      this.logger.debug('Fetching users by role', { operation: 'getUsersByRole', role });
      
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE role = $1 ORDER BY created_at DESC',
        [role]
      );
      
      this.logger.info('Successfully fetched users by role', { 
        operation: 'getUsersByRole', 
        role,
        count: result.rows.length 
      });
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch users by role', error as Error, { 
        operation: 'getUsersByRole', 
        role 
      });
      throw new Error('Failed to fetch users by role');
    }
  }

  async getUsersByCountry(country: string): Promise<User[]> {
    try {
      this.logger.debug('Fetching users by country', { operation: 'getUsersByCountry', country });
      
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE country = $1 ORDER BY created_at DESC',
        [country]
      );
      
      this.logger.info('Successfully fetched users by country', { 
        operation: 'getUsersByCountry', 
        country,
        count: result.rows.length 
      });
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch users by country', error as Error, { 
        operation: 'getUsersByCountry', 
        country 
      });
      throw new Error('Failed to fetch users by country');
    }
  }

  async getCountryStats(): Promise<Array<{country: string, userCount: number}>> {
    try {
      this.logger.debug('Fetching country statistics', { operation: 'getCountryStats' });
      
      const result = await db.query(
        'SELECT country, COUNT(*) as "userCount" FROM users WHERE country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC'
      );
      
      this.logger.info('Successfully fetched country statistics', { 
        operation: 'getCountryStats', 
        countryCount: result.rows.length 
      });
      
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch country statistics', error as Error, { operation: 'getCountryStats' });
      throw new Error('Failed to fetch country stats');
    }
  }
}

// Create singleton instance
export const userRepository = new UserRepository(); 