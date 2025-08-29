import { Hono } from 'hono';
import { UserService } from '../services/user-service';
import { PasswordService } from '../auth/password-service';
import { JWTService } from '../auth/jwt-service';
import { SessionService } from '../auth/session-service';
import { jwtAuth, getUserFromContext } from '../middleware/auth-middleware';
import { 
  loginRateLimit, 
  registerRateLimit, 
  passwordResetRateLimit,
  refreshTokenRateLimit,
  getUserAgent
} from '../middleware/rate-limit-middleware';
import type { Env } from '../index';

const authRoutes = new Hono<{ Bindings: Env }>();

// Register new user
authRoutes.post('/register', registerRateLimit, async (c) => {
  try {
    const { name, email, password, type = 'CUSTOMER', bio } = await c.req.json();

    // Validate required fields
    if (!name || !email || !password) {
      return c.json({ 
        error: 'Missing required fields: name, email, password' 
      }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
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

    // Create tokens
    const accessTokenData = await JWTService.createAccessToken(
      user.id,
      user.email,
      user.type,
      c.env.JWT_SECRET
    );

    const refreshTokenData = await JWTService.createRefreshToken(
      user.id,
      c.env.JWT_SECRET
    );

    // Store session in KV
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.createSession(
        user.id,
        refreshTokenData.jti,
        refreshTokenData.token,
        refreshTokenData.expiresAt,
        getUserAgent(c),
        c.req.header('CF-Connecting-IP')
      );
    }

    // Return user data and tokens (exclude password fields)
    const { passwordHash, passwordSalt, ...safeUser } = user;
    
    return c.json({
      user: safeUser,
      accessToken: accessTokenData.token,
      refreshToken: refreshTokenData.token,
      expiresAt: accessTokenData.expiresAt.toISOString()
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

// Login user
authRoutes.post('/login', loginRateLimit, async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ 
        error: 'Missing required fields: email, password' 
      }, 400);
    }

    const userService = new UserService(c.env);

    // Get user by email
    const user = await userService.getUserByEmail(email);
    if (!user || !user.passwordHash || !user.passwordSalt) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return c.json({ 
        error: 'Account temporarily locked due to too many failed attempts',
        lockedUntil: user.lockedUntil.toISOString()
      }, 423);
    }

    // Verify password
    const isValidPassword = await PasswordService.verifyPassword(
      password,
      user.passwordHash,
      user.passwordSalt
    );

    if (!isValidPassword) {
      // Increment login attempts
      await userService.incrementLoginAttempts(user.id);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Reset login attempts and update last login
    await userService.resetLoginAttempts(user.id);
    await userService.updateLastLogin(user.id);

    // Create tokens
    const accessTokenData = await JWTService.createAccessToken(
      user.id,
      user.email,
      user.type,
      c.env.JWT_SECRET
    );

    const refreshTokenData = await JWTService.createRefreshToken(
      user.id,
      c.env.JWT_SECRET
    );

    // Store session in KV
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.createSession(
        user.id,
        refreshTokenData.jti,
        refreshTokenData.token,
        refreshTokenData.expiresAt,
        getUserAgent(c),
        c.req.header('CF-Connecting-IP')
      );
    }

    // Return user data and tokens (exclude password fields)
    const { passwordHash, passwordSalt, loginAttempts, lockedUntil, ...safeUser } = user;
    
    return c.json({
      user: safeUser,
      accessToken: accessTokenData.token,
      refreshToken: refreshTokenData.token,
      expiresAt: accessTokenData.expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Failed to login' }, 500);
  }
});

// Refresh access token
authRoutes.post('/refresh', refreshTokenRateLimit, async (c) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ error: 'Refresh token required' }, 400);
    }

    // Verify refresh token
    const payload = await JWTService.verifyToken(refreshToken, c.env.JWT_SECRET);
    if (!payload || payload.type !== 'refresh') {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const refreshPayload = payload as any;

    // Check if session exists in KV
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      const session = await sessionService.getSession(refreshPayload.sub, refreshPayload.jti);
      
      if (!session || session.refreshToken !== refreshToken) {
        return c.json({ error: 'Session not found or invalid' }, 401);
      }
    }

    // Get user data
    const userService = new UserService(c.env);
    const user = await userService.getUserById(refreshPayload.sub);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Create new access token
    const accessTokenData = await JWTService.createAccessToken(
      user.id,
      user.email,
      user.type,
      c.env.JWT_SECRET
    );

    return c.json({
      accessToken: accessTokenData.token,
      expiresAt: accessTokenData.expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Failed to refresh token' }, 500);
  }
});

// Logout user
authRoutes.post('/logout', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);

    // Delete session from KV
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.deleteSession(user.sub, user.jti);
    }

    return c.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Failed to logout' }, 500);
  }
});

// Logout from all devices
authRoutes.post('/logout-all', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);

    // Delete all sessions for user
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.deleteAllUserSessions(user.sub);
    }

    return c.json({ message: 'Logged out from all devices successfully' });

  } catch (error) {
    console.error('Logout all error:', error);
    return c.json({ error: 'Failed to logout from all devices' }, 500);
  }
});

// Get current user profile
authRoutes.get('/me', jwtAuth, async (c) => {
  try {
    const user = getUserFromContext(c);
    const userService = new UserService(c.env);
    
    const userData = await userService.getUserById(user.sub);
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Return user data (exclude password fields)
    const { passwordHash, passwordSalt, loginAttempts, lockedUntil, ...safeUser } = userData;
    
    return c.json(safeUser);

  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get user profile' }, 500);
  }
});

// Request password reset
authRoutes.post('/forgot-password', passwordResetRateLimit, async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const userService = new UserService(c.env);
    const user = await userService.getUserByEmail(email);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return c.json({ 
        message: 'If the email exists, a password reset link has been sent' 
      });
    }

    // Generate reset token
    const resetToken = PasswordService.generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in KV
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.storePasswordResetToken(resetToken, user.id, expiresAt);
    }

    // TODO: Send email with reset token
    // For now, return the token (in production, this should be sent via email)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return c.json({ 
      message: 'If the email exists, a password reset link has been sent',
      // Remove this in production:
      resetToken: resetToken
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({ error: 'Failed to process password reset request' }, 500);
  }
});

// Reset password with token
authRoutes.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({ 
        error: 'Missing required fields: token, newPassword' 
      }, 400);
    }

    // Validate password strength
    if (!PasswordService.isPasswordStrong(newPassword)) {
      return c.json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters' 
      }, 400);
    }

    // Verify and consume reset token
    let userId: string | null = null;
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      userId = await sessionService.consumePasswordResetToken(token);
    }

    if (!userId) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    // Hash new password
    const { hash, salt } = await PasswordService.hashPasswordForStorage(newPassword);

    // Update user password
    const userService = new UserService(c.env);
    await userService.updatePassword(userId, hash, salt);

    // Invalidate all sessions for security
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.deleteAllUserSessions(userId);
    }

    return c.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({ error: 'Failed to reset password' }, 500);
  }
});

// Change password (authenticated)
authRoutes.post('/change-password', jwtAuth, async (c) => {
  try {
    const { currentPassword, newPassword } = await c.req.json();
    const user = getUserFromContext(c);

    if (!currentPassword || !newPassword) {
      return c.json({ 
        error: 'Missing required fields: currentPassword, newPassword' 
      }, 400);
    }

    // Validate new password strength
    if (!PasswordService.isPasswordStrong(newPassword)) {
      return c.json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters' 
      }, 400);
    }

    const userService = new UserService(c.env);
    const userData = await userService.getUserById(user.sub);
    
    if (!userData || !userData.passwordHash || !userData.passwordSalt) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify current password
    const isValidPassword = await PasswordService.verifyPassword(
      currentPassword,
      userData.passwordHash,
      userData.passwordSalt
    );

    if (!isValidPassword) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Hash new password
    const { hash, salt } = await PasswordService.hashPasswordForStorage(newPassword);

    // Update password
    await userService.updatePassword(userData.id, hash, salt);

    // Invalidate all other sessions for security (keep current session)
    if (c.env.KV_AUTH) {
      const sessionService = new SessionService(c.env.KV_AUTH);
      await sessionService.deleteAllUserSessions(userData.id);
      
      // Note: Current session is also invalidated, user will need to login again
    }

    return c.json({ 
      message: 'Password changed successfully. Please login again with your new password.' 
    });

  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

export { authRoutes };