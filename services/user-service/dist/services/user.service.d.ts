import { UserRepository, CreateUserRequest, UpdateUserRequest } from './user-repository';
import { User } from '@/types/user';
export declare class UserService {
    private repository;
    constructor(repository: UserRepository);
    getUsers(): Promise<User[]>;
    getUserById(id: string): Promise<User | null>;
    createUser(userData: CreateUserRequest): Promise<User>;
    updateUser(id: string, userData: UpdateUserRequest): Promise<User | null>;
    deleteUser(id: string): Promise<boolean>;
}
//# sourceMappingURL=user.service.d.ts.map