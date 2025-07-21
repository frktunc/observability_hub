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
export declare class UserRepository {
    findAll(): Promise<User[]>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    create(userData: CreateUserRequest): Promise<User>;
    update(id: string, userData: UpdateUserRequest): Promise<User | null>;
    delete(id: string): Promise<boolean>;
}
export declare const userRepository: UserRepository;
//# sourceMappingURL=user-repository.d.ts.map