import { Hono } from 'hono';
import type { Env } from '../index';

const authRoutes = new Hono<{ Bindings: Env }>();

// Login endpoint
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    
    // TODO: Implement proper password verification
    // For now, we'll create a simple mock authentication
    
    // In a real implementation, you would:
    // 1. Hash the password and compare with stored hash
    // 2. Verify user credentials against the database
    // 3. Handle account lockouts, rate limiting, etc.
    
    const mockUser = {
      id: crypto.randomUUID(),
      email,
      name: 'Test User',
      type: 'CUSTOMER' as const,
    };
    
    // Generate simple token (JWT implementation can be added later)
    const token = `mock-token-${mockUser.id}-${Date.now()}`;
    
    return c.json({
      user: mockUser,
      token,
      expiresIn: 86400, // 24 hours in seconds
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Token verification endpoint (simplified)
authRoutes.post('/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid token' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  // Simple token validation (JWT can be added later)
  if (token.startsWith('mock-token-')) {
    return c.json({
      valid: true,
      user: {
        id: 'test-user',
        email: 'test@example.com',
        type: 'CUSTOMER',
      },
    });
  }
  
  return c.json({ error: 'Invalid token' }, 401);
});

// Logout endpoint
authRoutes.post('/logout', async (c) => {
  return c.json({ message: 'Logged out successfully' });
});

// API Key authentication middleware
export const apiKeyAuth = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return c.json({ error: 'API key required' }, 401);
  }
  
  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  await next();
};

// Simple authentication middleware for protected routes
export const jwtAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid token' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  // Simple token validation (JWT can be added later)
  if (token.startsWith('mock-token-')) {
    // Add mock payload to context
    c.set('jwtPayload', {
      sub: 'test-user',
      email: 'test@example.com',
      type: 'CUSTOMER',
    });
    
    await next();
  } else {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

export { authRoutes };