/**
 * Rate Limiting Middleware - Protect endpoints from abuse
 */

import { Context, Next } from 'hono';
import { RateLimitService } from '../auth/rate-limit-service';
import type { Env } from '../index';

/**
 * Rate limiting middleware factory
 */
export const rateLimit = (
  action: keyof typeof RateLimitService.CONFIGS,
  identifierType: 'ip' | 'user' | 'email' | 'custom' = 'ip',
  customIdentifier?: (c: Context) => string
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (!c.env.KV_AUTH) {
      // If KV is not available, skip rate limiting
      await next();
      return;
    }

    try {
      const rateLimitService = new RateLimitService(c.env.KV_AUTH);
      let identifier: string;

      // Determine identifier based on type
      switch (identifierType) {
        case 'ip':
          identifier = getClientIP(c);
          break;
        case 'user':
          const user = c.get('user');
          if (!user) {
            return c.json({ error: 'Authentication required for user-based rate limiting' }, 401);
          }
          identifier = `user:${user.sub}`;
          break;
        case 'email':
          const body = await c.req.json().catch(() => ({}));
          if (!body.email) {
            return c.json({ error: 'Email required for email-based rate limiting' }, 400);
          }
          identifier = `email:${body.email}`;
          // Reset request body for next middleware
          c.req = new Request(c.req.url, {
            method: c.req.method,
            headers: c.req.headers,
            body: JSON.stringify(body)
          });
          break;
        case 'custom':
          if (!customIdentifier) {
            throw new Error('Custom identifier function required');
          }
          identifier = customIdentifier(c);
          break;
        default:
          identifier = getClientIP(c);
      }

      // Check rate limit
      const result = await rateLimitService.checkRateLimit(identifier, action);

      // Add rate limit headers
      c.header('X-RateLimit-Limit', RateLimitService.CONFIGS[action].maxAttempts.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

      if (!result.allowed) {
        if (result.retryAfter) {
          c.header('Retry-After', result.retryAfter.toString());
        }
        
        return c.json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString()
        }, 429);
      }

      await next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue on error to avoid blocking legitimate requests
      await next();
    }
  };
};

/**
 * Login rate limiting middleware
 */
export const loginRateLimit = rateLimit('LOGIN', 'ip');

/**
 * Registration rate limiting middleware
 */
export const registerRateLimit = rateLimit('REGISTER', 'ip');

/**
 * Password reset rate limiting middleware
 */
export const passwordResetRateLimit = rateLimit('PASSWORD_RESET', 'email');

/**
 * Token refresh rate limiting middleware
 */
export const refreshTokenRateLimit = rateLimit('REFRESH_TOKEN', 'user');

/**
 * General API rate limiting middleware
 */
export const apiRateLimit = rateLimit('API_GENERAL', 'ip');

/**
 * Distributed rate limiting (multiple identifiers)
 */
export const distributedRateLimit = (
  action: keyof typeof RateLimitService.CONFIGS,
  identifierTypes: Array<'ip' | 'user' | 'email'>
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (!c.env.KV_AUTH) {
      await next();
      return;
    }

    try {
      const rateLimitService = new RateLimitService(c.env.KV_AUTH);
      const identifiers: string[] = [];

      // Collect all identifiers
      for (const type of identifierTypes) {
        switch (type) {
          case 'ip':
            identifiers.push(getClientIP(c));
            break;
          case 'user':
            const user = c.get('user');
            if (user) {
              identifiers.push(`user:${user.sub}`);
            }
            break;
          case 'email':
            const body = await c.req.json().catch(() => ({}));
            if (body.email) {
              identifiers.push(`email:${body.email}`);
            }
            break;
        }
      }

      // Check distributed rate limit
      const result = await rateLimitService.checkDistributedRateLimit(identifiers, action);

      // Add rate limit headers
      c.header('X-RateLimit-Limit', RateLimitService.CONFIGS[action].maxAttempts.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

      if (!result.allowed) {
        if (result.retryAfter) {
          c.header('Retry-After', result.retryAfter.toString());
        }
        
        return c.json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString()
        }, 429);
      }

      await next();
    } catch (error) {
      console.error('Distributed rate limiting error:', error);
      await next();
    }
  };
};

/**
 * Sliding window rate limiting
 */
export const slidingWindowRateLimit = (
  maxRequests: number,
  windowMinutes: number,
  identifierType: 'ip' | 'user' = 'ip'
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (!c.env.KV_AUTH) {
      await next();
      return;
    }

    try {
      const rateLimitService = new RateLimitService(c.env.KV_AUTH);
      let identifier: string;

      if (identifierType === 'user') {
        const user = c.get('user');
        if (!user) {
          return c.json({ error: 'Authentication required' }, 401);
        }
        identifier = `user:${user.sub}`;
      } else {
        identifier = getClientIP(c);
      }

      const result = await rateLimitService.checkSlidingWindowRateLimit(
        identifier,
        maxRequests,
        windowMinutes
      );

      // Add rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

      if (!result.allowed) {
        if (result.retryAfter) {
          c.header('Retry-After', result.retryAfter.toString());
        }
        
        return c.json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString()
        }, 429);
      }

      await next();
    } catch (error) {
      console.error('Sliding window rate limiting error:', error);
      await next();
    }
  };
};

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
  // Try Cloudflare headers first
  const cfConnectingIP = c.req.header('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Try other common headers
  const xForwardedFor = c.req.header('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = c.req.header('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }

  // Fallback to a default (should not happen in Cloudflare Workers)
  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(c: Context): string {
  return c.req.header('User-Agent') || 'unknown';
}