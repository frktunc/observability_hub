import { UserRepository } from './user-repository.js';
export declare class UserService {
    private repository;
    constructor(repository: UserRepository);
    getUsers(): Promise<any>;
    createUser(user: any): Promise<any>;
    getUserById(id: string): Promise<any>;
}
//# sourceMappingURL=user.service.d.ts.map