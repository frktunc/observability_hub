import { Request, Response } from 'express';
import { UserService } from '@/services/user.service';
import { userRepository } from '@/services/user-repository';

const userService = new UserService(userRepository);

export const getUsers = async (req: Request, res: Response) => {
  const users = await userService.getUsers();
  res.json({ success: true, data: users });
};

export const createUser = async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, data: user });
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ success: false, message: 'User ID is required' });
    return;
  }
  const user = await userService.getUserById(id);
  if (user) {
    res.json({ success: true, data: user });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
};
