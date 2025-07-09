export interface User extends Record<string, unknown> {
    id: string;
    name: string;
    email: string;
    role: string;
    country?: string;
    createdAt: string;
    updatedAt?: string;
}
export interface CreateUserRequest {
    name: string;
    email: string;
    role?: string;
    country?: string;
}
export interface UpdateUserRequest {
    name?: string;
    email?: string;
    role?: string;
    country?: string;
}
export declare class UserRepository {
    getAllUsers(): Promise<User[]>;
    getUserById(id: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    createUser(userData: CreateUserRequest): Promise<User>;
    updateUser(id: string, userData: UpdateUserRequest): Promise<User | null>;
    deleteUser(id: string): Promise<boolean>;
    getUsersCount(): Promise<number>;
    getUsersByRole(role: string): Promise<User[]>;
    getUsersByCountry(country: string): Promise<User[]>;
    getCountryStats(): Promise<Array<{
        country: string;
        userCount: number;
    }>>;
}
export declare const userRepository: UserRepository;
//# sourceMappingURL=user-repository.d.ts.map