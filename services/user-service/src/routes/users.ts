import { Router } from 'express';
import {
  getUsers,
  createUser,
  getUserById,
} from '@/controllers/user.controller';
import { tryCatch } from '@/middleware/try-catch';

const router = Router();

router.get('/', tryCatch(getUsers));
router.post('/', tryCatch(createUser));
router.get('/:id', tryCatch(getUserById));

export { router as userRoutes };
