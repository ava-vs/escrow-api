/**
 * Session Service - KV-based session management
 * Handles refresh tokens and session tracking
 */

export interface SessionData {
  userId: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userAgent?: string;
  ipAddress?: string;
  createdAt: number;
  lastUsed: number;
}

export interface RateLimitData {
  attempts: number;
  resetAt: number; // Unix timestamp
}

export class SessionService {
  private kv: KVNamespace;
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private static readonly PASSWORD_RESET_PREFIX = 'password_reset:';
  private static readonly MAX_SESSIONS_PER_USER = 5;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    jti: string,
    refreshToken: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const sessionKey = `${SessionService.SESSION_PREFIX}${userId}:${jti}`;
    const now = Date.now();

    const sessionData: SessionData = {
      userId,
      refreshToken,
      expiresAt: expiresAt.getTime(),
      userAgent,
      ipAddress,
      createdAt: now,
      lastUsed: now
    };

    // Store session with TTL
    const ttlSeconds = Math.floor((expiresAt.getTime() - now) / 1000);
    await this.kv.put(sessionKey, JSON.stringify(sessionData), {
      expirationTtl: ttlSeconds
    });

    // Clean up old sessions for this user
    await this.cleanupOldSessions(userId);
  }

  /**
   * Get session data
   */
  async getSession(userId: string, jti: string): Promise<SessionData | null> {
    const sessionKey = `${SessionService.SESSION_PREFIX}${userId}:${jti}`;
    const data = await this.kv.get(sessionKey);
    
    if (!data) {
      return null;
    }

    try {
      const sessionData: SessionData = JSON.parse(data);
      
      // Check if session is expired
      if (sessionData.expiresAt < Date.now()) {
        await this.deleteSession(userId, jti);
        return null;
      }

      return sessionData;
    } catch (error) {
      // Invalid session data, delete it
      await this.deleteSession(userId, jti);
      return null;
    }
  }

  /**
   * Update session last used time
   */
  async updateSessionLastUsed(userId: string, jti: string): Promise<void> {
    const sessionData = await this.getSession(userId, jti);
    if (!sessionData) {
      return;
    }

    sessionData.lastUsed = Date.now();
    
    const sessionKey = `${SessionService.SESSION_PREFIX}${userId}:${jti}`;
    const ttlSeconds = Math.floor((sessionData.expiresAt - Date.now()) / 1000);
    
    if (ttlSeconds > 0) {
      await this.kv.put(sessionKey, JSON.stringify(sessionData), {
        expirationTtl: ttlSeconds
      });
    }
  }

  /**
   * Delete a specific session
   */
  async deleteSession(userId: string, jti: string): Promise<void> {
    const sessionKey = `${SessionService.SESSION_PREFIX}${userId}:${jti}`;
    await this.kv.delete(sessionKey);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    // List all keys with the user prefix
    const prefix = `${SessionService.SESSION_PREFIX}${userId}:`;
    const list = await this.kv.list({ prefix });
    
    // Delete all sessions
    const deletePromises = list.keys.map(key => this.kv.delete(key.name));
    await Promise.all(deletePromises);
  }

  /**
   * Clean up old sessions (keep only the most recent ones)
   */
  private async cleanupOldSessions(userId: string): Promise<void> {
    const prefix = `${SessionService.SESSION_PREFIX}${userId}:`;
    const list = await this.kv.list({ prefix });
    
    if (list.keys.length <= SessionService.MAX_SESSIONS_PER_USER) {
      return;
    }

    // Get session data for all sessions
    const sessions: Array<{ key: string; data: SessionData }> = [];
    
    for (const key of list.keys) {
      const data = await this.kv.get(key.name);
      if (data) {
        try {
          const sessionData: SessionData = JSON.parse(data);
          sessions.push({ key: key.name, data: sessionData });
        } catch (error) {
          // Invalid session, delete it
          await this.kv.delete(key.name);
        }
      }
    }

    // Sort by last used time (newest first)
    sessions.sort((a, b) => b.data.lastUsed - a.data.lastUsed);

    // Delete oldest sessions
    const sessionsToDelete = sessions.slice(SessionService.MAX_SESSIONS_PER_USER);
    const deletePromises = sessionsToDelete.map(session => this.kv.delete(session.key));
    await Promise.all(deletePromises);
  }

  /**
   * Rate limiting for authentication attempts
   */
  async checkRateLimit(identifier: string, maxAttempts: number, windowMinutes: number): Promise<boolean> {
    const key = `${SessionService.RATE_LIMIT_PREFIX}${identifier}`;
    const data = await this.kv.get(key);
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    if (!data) {
      // First attempt
      const rateLimitData: RateLimitData = {
        attempts: 1,
        resetAt: now + windowMs
      };
      
      await this.kv.put(key, JSON.stringify(rateLimitData), {
        expirationTtl: windowMinutes * 60
      });
      
      return true;
    }

    try {
      const rateLimitData: RateLimitData = JSON.parse(data);
      
      // Check if window has expired
      if (now > rateLimitData.resetAt) {
        // Reset the counter
        const newRateLimitData: RateLimitData = {
          attempts: 1,
          resetAt: now + windowMs
        };
        
        await this.kv.put(key, JSON.stringify(newRateLimitData), {
          expirationTtl: windowMinutes * 60
        });
        
        return true;
      }

      // Check if limit exceeded
      if (rateLimitData.attempts >= maxAttempts) {
        return false;
      }

      // Increment attempts
      rateLimitData.attempts++;
      const ttlSeconds = Math.floor((rateLimitData.resetAt - now) / 1000);
      
      await this.kv.put(key, JSON.stringify(rateLimitData), {
        expirationTtl: ttlSeconds
      });
      
      return true;
    } catch (error) {
      // Invalid data, allow the attempt
      return true;
    }
  }

  /**
   * Store password reset token
   */
  async storePasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    const key = `${SessionService.PASSWORD_RESET_PREFIX}${token}`;
    const data = {
      userId,
      expiresAt: expiresAt.getTime(),
      createdAt: Date.now()
    };

    const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl: ttlSeconds
    });
  }

  /**
   * Get and consume password reset token
   */
  async consumePasswordResetToken(token: string): Promise<string | null> {
    const key = `${SessionService.PASSWORD_RESET_PREFIX}${token}`;
    const data = await this.kv.get(key);
    
    if (!data) {
      return null;
    }

    try {
      const resetData = JSON.parse(data);
      
      // Check if token is expired
      if (resetData.expiresAt < Date.now()) {
        await this.kv.delete(key);
        return null;
      }

      // Delete token (one-time use)
      await this.kv.delete(key);
      
      return resetData.userId;
    } catch (error) {
      await this.kv.delete(key);
      return null;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(identifier: string): Promise<{ attempts: number; resetAt: Date } | null> {
    const key = `${SessionService.RATE_LIMIT_PREFIX}${identifier}`;
    const data = await this.kv.get(key);
    
    if (!data) {
      return null;
    }

    try {
      const rateLimitData: RateLimitData = JSON.parse(data);
      return {
        attempts: rateLimitData.attempts,
        resetAt: new Date(rateLimitData.resetAt)
      };
    } catch (error) {
      return null;
    }
  }
}