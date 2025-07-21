import { UserRepository, CreateUserRequest, UpdateUserRequest } from './user-repository';
import { User } from '@/types/user';

export class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  async getUsers(): Promise<User[]> {
    return this.repository.findAll();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    // Here you could add business logic, validation, etc.
    return this.repository.create(userData);
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User | null> {
    // Add business logic before updating
    return this.repository.update(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}
