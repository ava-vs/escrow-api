import { Hono } from 'hono';
import { UserService } from '../services/user-service';
import { jwtAuth } from './auth';
import { getUserFromContext } from '../utils/auth';
import type { Env } from '../index';

const usersRoutes = new Hono<{ Bindings: Env }>();

// Create user
usersRoutes.post('/', async (c) => {
  try {
    const userService = new UserService(c.env);
    const userData = await c.req.json();
    
    // Validate required fields
    if (!userData.name || !userData.email || !userData.type) {
      return c.json({ 
        error: 'Missing required fields: name, email, type' 
      }, 400);
    }
    
    // Validate user type
    if (!['CUSTOMER', 'CONTRACTOR', 'PLATFORM'].includes(userData.type)) {
      return c.json({ 
        error: 'Invalid user type. Must be CUSTOMER, CONTRACTOR, or PLATFORM' 
      }, 400);
    }
    
    // Check if email already exists
    const existingUser = await userService.getUserByEmail(userData.email);
    if (existingUser) {
      return c.json({ 
        error: 'User with this email already exists' 
      }, 409);
    }
    
    const user = await userService.createUser({
      name: userData.name,
      email: userData.email,
      type: userData.type,
      balance: userData.balance || 0,
      bio: userData.bio,
      preferences: userData.preferences ? JSON.stringify(userData.preferences) : undefined,
    });
    
    return c.json(user, 201);
    
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Get all users
usersRoutes.get('/', jwtAuth, async (c) => {
  try {
    const userService = new UserService(c.env);
    const users = await userService.getAllUsers();
    
    return c.json(users);
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Get user by ID
usersRoutes.get('/:id', jwtAuth, async (c) => {
  try {
    const userId = c.req.param('id');
    const userService = new UserService(c.env);
    
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(user);
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Update user profile
usersRoutes.put('/:id', jwtAuth, async (c) => {
  try {
    const userId = c.req.param('id');
    const updateData = await c.req.json();
    const userService = new UserService(c.env);
    
    // Verify user exists
    const existingUser = await userService.getUserById(userId);
    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Check JWT payload to ensure user can only update their own profile
    const user = getUserFromContext(c);
    if (user.sub !== userId && user.type !== 'PLATFORM') {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Prepare update data
    const allowedFields = ['name', 'email', 'bio', 'preferences'];
    const filteredUpdateData: any = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'preferences' && typeof updateData[field] === 'object') {
          filteredUpdateData[field] = JSON.stringify(updateData[field]);
        } else {
          filteredUpdateData[field] = updateData[field];
        }
      }
    }
    
    const updatedUser = await userService.updateUserProfile(userId, filteredUpdateData);
    
    return c.json(updatedUser);
    
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Update user balance
usersRoutes.post('/:id/balance', jwtAuth, async (c) => {
  try {
    const userId = c.req.param('id');
    const { amount } = await c.req.json();
    const userService = new UserService(c.env);
    
    if (typeof amount !== 'number') {
      return c.json({ error: 'Amount must be a number' }, 400);
    }
    
    // Only platform users can modify balances
    const user = getUserFromContext(c);
    if (user.type !== 'PLATFORM') {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const updatedUser = await userService.updateUserBalance(userId, amount);
    
    return c.json(updatedUser);
    
  } catch (error) {
    console.error('Error updating balance:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json({ error: 'User not found' }, 404);
      }
      if (error.message.includes('Insufficient balance')) {
        return c.json({ error: 'Insufficient balance' }, 400);
      }
    }
    
    return c.json({ error: 'Failed to update balance' }, 500);
  }
});

// Get user balance
usersRoutes.get('/:id/balance', jwtAuth, async (c) => {
  try {
    const userId = c.req.param('id');
    const userService = new UserService(c.env);
    
    // Check JWT payload to ensure user can only view their own balance
    const currentUser = getUserFromContext(c);
    if (currentUser.sub !== userId && currentUser.type !== 'PLATFORM') {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ 
      userId: user.id,
      balance: user.balance,
      updatedAt: user.updatedAt 
    });
    
  } catch (error) {
    console.error('Error fetching balance:', error);
    return c.json({ error: 'Failed to fetch balance' }, 500);
  }
});

// Delete user
usersRoutes.delete('/:id', jwtAuth, async (c) => {
  try {
    const userId = c.req.param('id');
    const userService = new UserService(c.env);
    
    // Only platform users can delete accounts
    const user = getUserFromContext(c);
    if (user.type !== 'PLATFORM') {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const success = await userService.deleteUser(userId);
    
    if (!success) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

export { usersRoutes };