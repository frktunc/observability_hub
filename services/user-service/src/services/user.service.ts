import { UserRepository, CreateUserRequest } from '@/services/user-repository';
import { User } from '@/types/user';

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async getUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.userRepository.create(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
