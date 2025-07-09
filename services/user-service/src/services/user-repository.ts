import { v4 as uuidv4 } from 'uuid';
import { db } from './database';

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
  async getAllUsers(): Promise<User[]> {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users ORDER BY created_at DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const id = uuidv4();
      const role = userData.role || 'user';
      const country = userData.country || null;
      
      const result = await db.query(
        'INSERT INTO users (id, name, email, role, country) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt"',
        [id, userData.name, userData.email, role, country]
      );
      
      return result.rows[0];
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User | null> {
    try {
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
      return result.rows[0] || null;
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        throw new Error('User with this email already exists');
      }
      
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async getUsersCount(): Promise<number> {
    try {
      const result = await db.query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error counting users:', error);
      throw new Error('Failed to count users');
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE role = $1 ORDER BY created_at DESC',
        [role]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching users by role:', error);
      throw new Error('Failed to fetch users by role');
    }
  }

  async getUsersByCountry(country: string): Promise<User[]> {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, country, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE country = $1 ORDER BY created_at DESC',
        [country]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching users by country:', error);
      throw new Error('Failed to fetch users by country');
    }
  }

  async getCountryStats(): Promise<Array<{country: string, userCount: number}>> {
    try {
      const result = await db.query(
        'SELECT country, COUNT(*) as "userCount" FROM users WHERE country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching country stats:', error);
      throw new Error('Failed to fetch country stats');
    }
  }
}

// Create singleton instance
export const userRepository = new UserRepository(); 