export class UserRepository {
  getUsers() {
    // In a real application, this would fetch users from a database
    return Promise.resolve([
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Doe' },
    ]);
  }

  createUser(user: any) {
    // In a real application, this would save the user to a database
    return Promise.resolve({ id: '3', ...user });
  }

  getUserById(id: string) {
    // In a real application, this would fetch a user by ID from a database
    const users = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Doe' },
    ];
    const user = users.find((u) => u.id === id) ?? null;
    return Promise.resolve(user);
  }
}

export const userRepository = new UserRepository();
