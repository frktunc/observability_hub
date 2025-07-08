import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ObservabilityLogger } from '@observability-hub/log-client';
import { config, derivedConfig } from '../config';
import { userRepository, CreateUserRequest, UpdateUserRequest } from '../services/user-repository';

const router = Router();

// Initialize logger
const logger = new ObservabilityLogger({
  serviceName: config.SERVICE_NAME,
  serviceVersion: config.SERVICE_VERSION,
  environment: config.NODE_ENV,
  rabbitmqHostname: derivedConfig.rabbitmq.hostname,
  rabbitmqPort: derivedConfig.rabbitmq.port,
  rabbitmqUsername: derivedConfig.rabbitmq.user,
  rabbitmqPassword: derivedConfig.rabbitmq.password,
  rabbitmqVhost: derivedConfig.rabbitmq.vhost,
  rabbitmqExchange: derivedConfig.rabbitmq.exchange,
  defaultLogLevel: config.LOG_LEVEL as any,
});

// GET /api/v1/users - List all users
router.get('/', async (req: Request, res: Response) => {
  try {
    await logger.info('Users list requested', {
      operation: 'list_users',
      requestId: req.correlationId || undefined,
      clientIP: req.ip || undefined,
    });

    const users = await userRepository.getAllUsers();

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
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      await logger.warn('User creation failed - email already exists', {
        operation: 'create_user',
        requestId: req.correlationId || '',
        email,
      });

      res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
      return;
    }

    // Create new user
    const userData: CreateUserRequest = {
      name,
      email,
      role,
    };

    const newUser = await userRepository.createUser(userData);

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
      requestId: req.correlationId || '',
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
      requestId: req.correlationId || '',
      requestBody: req.body,
    });

    // Handle specific database errors
    if ((error as Error).message.includes('already exists')) {
      res.status(409).json({
        success: false,
        error: (error as Error).message,
      });
      return;
    }

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
    const user = await userRepository.getUserById(id as string);

    if (!user) {
      await logger.warn('User not found', {
        operation: 'get_user',
        requestId: req.correlationId || '',
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
      requestId: req.correlationId || '',
      userId: id,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    await logger.error('Failed to get user', error as Error, {
      operation: 'get_user',
      requestId: req.correlationId || '',
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

    // Check if user exists
    const existingUser = await userRepository.getUserById(id as string);
    if (!existingUser) {
      await logger.warn('User update failed - user not found', {
        operation: 'update_user',
        requestId: req.correlationId || '',
        userId: id,
      });

      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Update user
    const userData: UpdateUserRequest = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (role !== undefined) userData.role = role;

    const updatedUser = await userRepository.updateUser(id as string, userData);

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Log business event
    await logger.businessEvent({
      eventType: 'user.updated',
      aggregateId: updatedUser.id,
      aggregateType: 'User',
      eventVersion: 1,
      correlationId: req.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: updatedUser,
    });

    await logger.info('User updated successfully', {
      operation: 'update_user',
      requestId: req.correlationId || '',
      userId: id,
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    await logger.error('Failed to update user', error as Error, {
      operation: 'update_user',
      requestId: req.correlationId || '',
      userId: req.params.id,
      requestBody: req.body,
    });

    // Handle specific database errors
    if ((error as Error).message.includes('already exists')) {
      res.status(409).json({
        success: false,
        error: (error as Error).message,
      });
      return;
    }

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

    // Check if user exists
    const existingUser = await userRepository.getUserById(id as string);
    if (!existingUser) {
      await logger.warn('User deletion failed - user not found', {
        operation: 'delete_user',
        requestId: req.correlationId || '',
        userId: id,
      });

      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Delete user
    const deleted = await userRepository.deleteUser(id as string);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Log business event
    await logger.businessEvent({
      eventType: 'user.deleted',
      aggregateId: id as string,
      aggregateType: 'User',
      eventVersion: 1,
      correlationId: req.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      data: { id: id, deletedUser: existingUser },
    });

    await logger.info('User deleted successfully', {
      operation: 'delete_user',
      requestId: req.correlationId || '',
      userId: id,
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    await logger.error('Failed to delete user', error as Error, {
      operation: 'delete_user',
      requestId: req.correlationId || '',
      userId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/v1/users/role/:role - Get users by role
router.get('/role/:role', async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    
    await logger.info('Users by role requested', {
      operation: 'list_users_by_role',
      requestId: req.correlationId || '',
      role,
    });

    const users = await userRepository.getUsersByRole(role as string);

    res.json({
      success: true,
      data: users,
      count: users.length,
      role,
    });
  } catch (error) {
    await logger.error('Failed to list users by role', error as Error, {
      operation: 'list_users_by_role',
      requestId: req.correlationId || '',
      role: req.params.role,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as userRoutes }; 