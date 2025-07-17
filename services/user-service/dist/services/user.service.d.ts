import { UserRepository, CreateUserRequest } from '@/services/user-repository';
import { User } from '@/types/user';
export declare class UserService {
    private userRepository;
    constructor(userRepository: UserRepository);
    getUsers(): Promise<User[]>;
    createUser(userData: CreateUserRequest): Promise<User>;
    getUserById(id: string): Promise<User | null>;
}
//# sourceMappingURL=user.service.d.ts.map