import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service.js';
import { userRepository } from '../services/user-repository.js';

const userService = new UserService(userRepository);

const createUserBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
});

export const getUsers = async (req: Request, res: Response) => {
  const users = await userService.getUsers();
  res.json({ success: true, data: users });
};

export const createUser = async (req: Request, res: Response) => {
  const parsed = createUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const user = await userService.createUser(parsed.data);
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
