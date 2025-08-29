/**
 * Admin Routes - Special administrative operations
 * Protected by API key authentication
 */

import { Hono } from 'hono';
import { UserService } from '../services/user-service';
import { PasswordService } from '../auth/password-service';
import { validateApiKey } from '../middleware/auth-middleware';
import type { Env } from '../index';

const adminRoutes = new Hono<{ Bindings: Env }>();

// Add password to existing user (admin only)
adminRoutes.post('/add-password', validateApiKey, async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ 
        error: 'Missing required fields: email, password' 
      }, 400);
    }

    // Validate password strength
    if (!PasswordService.isPasswordStrong(password)) {
      return c.json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters' 
      }, 400);
    }

    const userService = new UserService(c.env);

    // Get user by email
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Hash password
    const { hash, salt } = await PasswordService.hashPasswordForStorage(password);

    // Update user password
    await userService.updatePassword(user.id, hash, salt);

    return c.json({ 
      message: 'Password added successfully',
      userId: user.id,
      email: user.email
    });

  } catch (error) {
    console.error('Add password error:', error);
    return c.json({ error: 'Failed to add password' }, 500);
  }
});

// Create user without rate limiting (admin only)
adminRoutes.post('/create-user', validateApiKey, async (c) => {
  try {
    const { name, email, password, type = 'CUSTOMER', bio } = await c.req.json();

    // Validate required fields
    if (!name || !email || !password) {
      return c.json({ 
        error: 'Missing required fields: name, email, password' 
      }, 400);
    }

    // Validate password strength
    if (!PasswordService.isPasswordStrong(password)) {
      return c.json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters' 
      }, 400);
    }

    // Validate user type
    if (!['CUSTOMER', 'CONTRACTOR', 'PLATFORM'].includes(type)) {
      return c.json({ 
        error: 'Invalid user type. Must be CUSTOMER, CONTRACTOR, or PLATFORM' 
      }, 400);
    }

    const userService = new UserService(c.env);

    // Check if email already exists
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return c.json({ 
        error: 'User with this email already exists' 
      }, 409);
    }

    // Hash password
    const { hash, salt } = await PasswordService.hashPasswordForStorage(password);

    // Create user
    const user = await userService.createUser({
      name,
      email,
      type,
      bio,
      passwordHash: hash,
      passwordSalt: salt,
      balance: 0,
    });

    // Return user data (exclude password fields)
    const { passwordHash, passwordSalt, ...safeUser } = user;
    
    return c.json({
      message: 'User created successfully',
      user: safeUser
    }, 201);

  } catch (error) {
    console.error('Admin create user error:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

export { adminRoutes };