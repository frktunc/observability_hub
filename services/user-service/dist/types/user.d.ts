export interface User {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin' | 'moderator';
    country?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=user.d.ts.map