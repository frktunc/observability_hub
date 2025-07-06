import { Router, Request, Response } from 'express';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { v4 as uuidv4 } from 'uuid';

// Mock user data (gerçek projede database kullanılır)
const users: any[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2', 
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
];

const router = Router();

// Initialize logger
const logger = new ObservabilityLogger({
  serviceName: 'user-service',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
});

// GET /api/v1/users - List all users
router.get('/', async (req: Request, res: Response) => {
  try {
    await logger.info('Users list requested', {
      operation: 'list_users',
      requestId: req.correlationId || undefined,
      clientIP: req.ip || undefined,
    });

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    await logger.error('Failed to list users', error as Error, {
      operation: 'list_users',
      requestId: req.correlationId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/v1/users - Create new user
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, role = 'user' } = req.body;

    // Validation
    if (!name || !email) {
      await logger.warn('Invalid user creation request', {
        operation: 'create_user',
        requestId: req.correlationId,
        validationErrors: { name: !name, email: !email },
      });

      res.status(400).json({
        success: false,
        error: 'Name and email are required',
      });
      return;
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      await logger.warn('User creation failed - email already exists', {
        operation: 'create_user',
        requestId: req.correlationId,
        email,
      });

      res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
      return;
    }

    // Create new user
    const newUser = {
      id: uuidv4(),
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    // Log business event
    await logger.businessEvent({
      eventType: 'user.created',
      aggregateId: newUser.id,
      aggregateType: 'User',
      eventVersion: 1,
      correlationId: req.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: newUser,
    });

    await logger.info('User created successfully', {
      operation: 'create_user',
      requestId: req.correlationId,
      userId: newUser.id,
      userEmail: newUser.email,
    });

    res.status(201).json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    await logger.error('Failed to create user', error as Error, {
      operation: 'create_user',
      requestId: req.correlationId,
      requestBody: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/v1/users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = users.find(u => u.id === id);

    if (!user) {
      await logger.warn('User not found', {
        operation: 'get_user',
        requestId: req.correlationId,
        userId: id,
      });

      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    await logger.info('User retrieved successfully', {
      operation: 'get_user',
      requestId: req.correlationId,
      userId: id,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    await logger.error('Failed to get user', error as Error, {
      operation: 'get_user',
      requestId: req.correlationId,
      userId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// PUT /api/v1/users/:id - Update user
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      await logger.warn('User not found for update', {
        operation: 'update_user',
        requestId: req.correlationId,
        userId: id,
      });

      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const oldUser = { ...users[userIndex] };
    const updatedUser = {
      ...users[userIndex],
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
      updatedAt: new Date().toISOString(),
    };

    users[userIndex] = updatedUser;

    // Log business event
    await logger.businessEvent({
      eventType: 'user.updated',
      aggregateId: id || '',
      aggregateType: 'User',
      eventVersion: 1,
      correlationId: req.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: {
        old: oldUser,
        new: updatedUser,
      },
    });

    await logger.info('User updated successfully', {
      operation: 'update_user',
      requestId: req.correlationId,
      userId: id,
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    await logger.error('Failed to update user', error as Error, {
      operation: 'update_user',
      requestId: req.correlationId,
      userId: req.params.id,
      requestBody: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// DELETE /api/v1/users/:id - Delete user
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      await logger.warn('User not found for deletion', {
        operation: 'delete_user',
        requestId: req.correlationId,
        userId: id,
      });

      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);

    // Log business event
    await logger.businessEvent({
      eventType: 'user.deleted',
      aggregateId: id || '',
      aggregateType: 'User',
      eventVersion: 1,
      correlationId: req.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: deletedUser,
    });

    await logger.info('User deleted successfully', {
      operation: 'delete_user',
      requestId: req.correlationId,
      userId: id,
    });

    res.status(204).send();
  } catch (error) {
    await logger.error('Failed to delete user', error as Error, {
      operation: 'delete_user',
      requestId: req.correlationId,
      userId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as userRoutes }; 