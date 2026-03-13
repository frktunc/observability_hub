import { db } from '@/services/database';

export class UserRepository {
  async getUsers() {
    const result = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async createUser(user: any) {
    const { name, email, role, country } = user;
    const result = await db.query(
      'INSERT INTO users (name, email, role, country) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, role || 'user', country]
    );
    return result.rows[0];
  }

  async getUserById(id: string) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
}

export const userRepository = new UserRepository();
