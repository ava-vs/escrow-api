/**
 * Authentication Middleware - JWT validation and user context
 */

import { Context, Next } from 'hono';
import { JWTService, type JWTPayload } from '../auth/jwt-service';
import { SessionService } from '../auth/session-service';
import type { Env } from '../index';

export interface AuthContext {
  user: JWTPayload;
}

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and sets user context
 */
export const jwtAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const payload = await JWTService.verifyToken(token, c.env.JWT_SECRET);
    if (!payload || payload.type === 'refresh') {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Check if it's an access token (not refresh token)
    const jwtPayload = payload as JWTPayload;
    
    // Optional: Check if session still exists in KV (skip for now to debug JWT)
    if (c.env.KV_AUTH) {
      try {
        const sessionService = new SessionService(c.env.KV_AUTH);
        const session = await sessionService.getSession(jwtPayload.sub, jwtPayload.jti);
        
        if (session) {
          // Update session last used time
          await sessionService.updateSessionLastUsed(jwtPayload.sub, jwtPayload.jti);
        }
        // Don't fail if session not found in KV - JWT is still valid
      } catch (error) {
        console.error('KV session check failed:', error);
        // Continue with JWT validation only
      }
    }

    // Set user context
    c.set('user', jwtPayload);
    
    await next();
  } catch (error) {
    console.error('JWT Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
};

/**
 * Optional JWT Authentication Middleware
 * Sets user context if token is present and valid, but doesn't require it
 */
export const optionalJwtAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await JWTService.verifyToken(token, c.env.JWT_SECRET);
      
      if (payload && payload.type !== 'refresh') {
        const jwtPayload = payload as JWTPayload;
        c.set('user', jwtPayload);
        
        // Update session if KV is available
        if (c.env.KV_AUTH) {
          const sessionService = new SessionService(c.env.KV_AUTH);
          await sessionService.updateSessionLastUsed(jwtPayload.sub, jwtPayload.jti);
        }
      }
    }
    
    await next();
  } catch (error) {
    // Continue without authentication on error
    await next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: Array<'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM'>) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user') as JWTPayload;
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!allowedRoles.includes(user.type)) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.type
      }, 403);
    }

    await next();
  };
};

/**
 * User ownership middleware
 * Ensures user can only access their own resources
 */
export const requireOwnership = (userIdParam: string = 'id') => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user') as JWTPayload;
    const resourceUserId = c.req.param(userIdParam);
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Platform users can access any resource
    if (user.type === 'PLATFORM') {
      await next();
      return;
    }

    // Users can only access their own resources
    if (user.sub !== resourceUserId) {
      return c.json({ error: 'Access denied: resource ownership required' }, 403);
    }

    await next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const user = c.get('user') as JWTPayload;
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  if (user.type !== 'PLATFORM') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
};

/**
 * Get user from context helper
 */
export const getUserFromContext = (c: Context): JWTPayload => {
  const user = c.get('user') as JWTPayload;
  if (!user) {
    throw new Error('User not found in context');
  }
  return user;
};

/**
 * Check if user has permission for resource
 */
export const hasPermission = (
  user: JWTPayload,
  resourceUserId: string,
  allowedRoles?: Array<'CUSTOMER' | 'CONTRACTOR' | 'PLATFORM'>
): boolean => {
  // Platform users have access to everything
  if (user.type === 'PLATFORM') {
    return true;
  }

  // Check role permissions if specified
  if (allowedRoles && !allowedRoles.includes(user.type)) {
    return false;
  }

  // Check ownership
  return user.sub === resourceUserId;
};

/**
 * Validate API key middleware (for system-to-system communication)
 */
export const validateApiKey = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  await next();
};