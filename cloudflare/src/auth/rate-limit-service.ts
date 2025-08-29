/**
 * Rate Limit Service - Advanced rate limiting for authentication
 * Provides multiple rate limiting strategies
 */

export interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
  blockDurationMinutes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

export class RateLimitService {
  private kv: KVNamespace;
  
  // Rate limit configurations
  static readonly CONFIGS = {
    LOGIN: { maxAttempts: 5, windowMinutes: 15, blockDurationMinutes: 15 },
    REGISTER: { maxAttempts: 3, windowMinutes: 60, blockDurationMinutes: 60 },
    PASSWORD_RESET: { maxAttempts: 3, windowMinutes: 60, blockDurationMinutes: 60 },
    REFRESH_TOKEN: { maxAttempts: 10, windowMinutes: 5, blockDurationMinutes: 5 },
    API_GENERAL: { maxAttempts: 100, windowMinutes: 1 }
  };

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Check rate limit for a specific action
   */
  async checkRateLimit(
    identifier: string,
    action: keyof typeof RateLimitService.CONFIGS,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const config = customConfig || RateLimitService.CONFIGS[action];
    const key = `rate_limit:${action}:${identifier}`;
    
    return await this.checkLimit(key, config);
  }

  /**
   * Check rate limit by IP address
   */
  async checkIPRateLimit(
    ipAddress: string,
    action: keyof typeof RateLimitService.CONFIGS,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    return await this.checkRateLimit(ipAddress, action, customConfig);
  }

  /**
   * Check rate limit by user ID
   */
  async checkUserRateLimit(
    userId: string,
    action: keyof typeof RateLimitService.CONFIGS,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    return await this.checkRateLimit(`user:${userId}`, action, customConfig);
  }

  /**
   * Check rate limit by email
   */
  async checkEmailRateLimit(
    email: string,
    action: keyof typeof RateLimitService.CONFIGS,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    return await this.checkRateLimit(`email:${email}`, action, customConfig);
  }

  /**
   * Core rate limiting logic
   */
  private async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowMinutes * 60 * 1000;
    const blockMs = (config.blockDurationMinutes || config.windowMinutes) * 60 * 1000;

    try {
      const data = await this.kv.get(key);
      
      if (!data) {
        // First request
        const limitData = {
          attempts: 1,
          windowStart: now,
          resetAt: now + windowMs,
          blocked: false
        };

        await this.kv.put(key, JSON.stringify(limitData), {
          expirationTtl: Math.ceil(windowMs / 1000)
        });

        return {
          allowed: true,
          remaining: config.maxAttempts - 1,
          resetAt: new Date(now + windowMs)
        };
      }

      const limitData = JSON.parse(data);

      // Check if currently blocked
      if (limitData.blocked && now < limitData.resetAt) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(limitData.resetAt),
          retryAfter: Math.ceil((limitData.resetAt - now) / 1000)
        };
      }

      // Check if window has expired
      if (now >= limitData.resetAt) {
        // Reset the window
        const newLimitData = {
          attempts: 1,
          windowStart: now,
          resetAt: now + windowMs,
          blocked: false
        };

        await this.kv.put(key, JSON.stringify(newLimitData), {
          expirationTtl: Math.ceil(windowMs / 1000)
        });

        return {
          allowed: true,
          remaining: config.maxAttempts - 1,
          resetAt: new Date(now + windowMs)
        };
      }

      // Check if limit exceeded
      if (limitData.attempts >= config.maxAttempts) {
        // Block the identifier
        limitData.blocked = true;
        limitData.resetAt = now + blockMs;

        await this.kv.put(key, JSON.stringify(limitData), {
          expirationTtl: Math.ceil(blockMs / 1000)
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(limitData.resetAt),
          retryAfter: Math.ceil(blockMs / 1000)
        };
      }

      // Increment attempts
      limitData.attempts++;
      const ttlSeconds = Math.ceil((limitData.resetAt - now) / 1000);

      await this.kv.put(key, JSON.stringify(limitData), {
        expirationTtl: ttlSeconds
      });

      return {
        allowed: true,
        remaining: config.maxAttempts - limitData.attempts,
        resetAt: new Date(limitData.resetAt)
      };

    } catch (error) {
      // On error, allow the request but log it
      console.error('Rate limit check failed:', error);
      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        resetAt: new Date(now + windowMs)
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetRateLimit(
    identifier: string,
    action: keyof typeof RateLimitService.CONFIGS
  ): Promise<void> {
    const key = `rate_limit:${action}:${identifier}`;
    await this.kv.delete(key);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    identifier: string,
    action: keyof typeof RateLimitService.CONFIGS
  ): Promise<{
    attempts: number;
    remaining: number;
    resetAt: Date;
    blocked: boolean;
  } | null> {
    const key = `rate_limit:${action}:${identifier}`;
    const data = await this.kv.get(key);

    if (!data) {
      return null;
    }

    try {
      const limitData = JSON.parse(data);
      const config = RateLimitService.CONFIGS[action];

      return {
        attempts: limitData.attempts,
        remaining: Math.max(0, config.maxAttempts - limitData.attempts),
        resetAt: new Date(limitData.resetAt),
        blocked: limitData.blocked || false
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Implement sliding window rate limiting
   */
  async checkSlidingWindowRateLimit(
    identifier: string,
    maxRequests: number,
    windowMinutes: number
  ): Promise<RateLimitResult> {
    const key = `sliding:${identifier}`;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    try {
      const data = await this.kv.get(key);
      let timestamps: number[] = [];

      if (data) {
        timestamps = JSON.parse(data);
      }

      // Remove timestamps outside the window
      timestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

      // Check if limit exceeded
      if (timestamps.length >= maxRequests) {
        const oldestTimestamp = Math.min(...timestamps);
        const resetAt = oldestTimestamp + windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(resetAt),
          retryAfter: Math.ceil((resetAt - now) / 1000)
        };
      }

      // Add current timestamp
      timestamps.push(now);

      // Store updated timestamps
      await this.kv.put(key, JSON.stringify(timestamps), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });

      return {
        allowed: true,
        remaining: maxRequests - timestamps.length,
        resetAt: new Date(now + windowMs)
      };

    } catch (error) {
      console.error('Sliding window rate limit check failed:', error);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowMs)
      };
    }
  }

  /**
   * Implement distributed rate limiting with multiple keys
   */
  async checkDistributedRateLimit(
    identifiers: string[],
    action: keyof typeof RateLimitService.CONFIGS,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const results = await Promise.all(
      identifiers.map(id => this.checkRateLimit(id, action, customConfig))
    );

    // If any identifier is blocked, block the request
    const blocked = results.find(result => !result.allowed);
    if (blocked) {
      return blocked;
    }

    // Return the most restrictive result
    return results.reduce((most, current) => 
      current.remaining < most.remaining ? current : most
    );
  }
}