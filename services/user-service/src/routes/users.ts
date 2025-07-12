import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ObservabilityLogger } from '@observability-hub/observability';
import { config, derivedConfig } from '../config';
import { userRepository, CreateUserRequest, UpdateUserRequest } from '../services/user-repository';

const router = Router();

// Initialize logger for route-level logging
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
    const { name, email, role = 'user', country } = req.body;

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

    // Validate country code if provided (should be 3-letter ISO code)
    if (country && (!country.match(/^[A-Z]{3}$/))) {
      await logger.warn('Invalid country code provided', {
        operation: 'create_user',
        requestId: req.correlationId,
        country,
      });

      res.status(400).json({
        success: false,
        error: 'Country must be a valid 3-letter ISO country code (e.g., TUR, USA, FRA)',
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
      country,
    };

    const newUser = await userRepository.createUser(userData);

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
    const { name, email, role, country } = req.body;

    // Validate country code if provided
    if (country && (!country.match(/^[A-Z]{3}$/))) {
      await logger.warn('Invalid country code provided for update', {
        operation: 'update_user',
        requestId: req.correlationId,
        userId: id,
        country,
      });

      res.status(400).json({
        success: false,
        error: 'Country must be a valid 3-letter ISO country code (e.g., TUR, USA, FRA)',
      });
      return;
    }

    // Update user
    const userData: UpdateUserRequest = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (role !== undefined) userData.role = role;
    if (country !== undefined) userData.country = country;

    const updatedUser = await userRepository.updateUser(id as string, userData);

    if (!updatedUser) {
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
    const deleted = await userRepository.deleteUser(id as string);

    if (!deleted) {
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

    await logger.info('User deleted successfully', {
      operation: 'delete_user',
      requestId: req.correlationId || '',
      userId: id,
    });

    res.status(204).send();
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

// GET /api/v1/users/stats/count - Get user count
router.get('/stats/count', async (req: Request, res: Response): Promise<void> => {
  try {
    await logger.info('User count requested', {
      operation: 'get_user_count',
      requestId: req.correlationId || undefined,
    });

    const count = await userRepository.getUsersCount();

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    await logger.error('Failed to get user count', error as Error, {
      operation: 'get_user_count',
      requestId: req.correlationId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/v1/users/stats/country - Get country statistics
router.get('/stats/country', async (req: Request, res: Response): Promise<void> => {
  try {
    await logger.info('Country statistics requested', {
      operation: 'get_country_stats',
      requestId: req.correlationId || undefined,
    });

    const stats = await userRepository.getCountryStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    await logger.error('Failed to get country statistics', error as Error, {
      operation: 'get_country_stats',
      requestId: req.correlationId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as userRoutes }; 