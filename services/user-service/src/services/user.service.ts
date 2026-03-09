import { userRepository, UserRepository } from './user-repository.js';

export class UserService {
  constructor(private repository: UserRepository) {}

  getUsers() {
    return this.repository.getUsers();
  }

  createUser(user: any) {
    return this.repository.createUser(user);
  }

  getUserById(id: string) {
    return this.repository.getUserById(id);
  }
}
