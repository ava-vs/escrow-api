/**
 * Auth module for JWT authentication
 * Handles token generation, verification and refresh
 * This implementation is part of the unified JWT authentication system
 * shared between Ailock and Escrow API
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/db';
import { eq, and, gt } from 'drizzle-orm';
import { authTokens } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET as string;
// Access token expiration time (15 minutes)
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
// Refresh token expiration time (30 days)
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Interface for decoded JWT token
 */
interface DecodedToken {
  sub: string;
  exp: number;
  [key: string]: any;
}

/**
 * Interface for token response
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT access and refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<TokenResponse>} Generated tokens
 */
export async function generateTokens(userId: string): Promise<TokenResponse> {
  // Create access token
  const accessToken = jwt.sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY },
    JWT_SECRET
  );
  
  // Create refresh token
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  // Save refresh token in database
  await db.insert(authTokens).values({
    id: uuidv4(),
    userId: userId,
    service: 'ESCROW',
    refreshHash: refreshHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
    createdAt: new Date()
  });
  
  return {
    accessToken,
    refreshToken
  };
}

/**
 * Verify JWT access token
 * @param {string} token - JWT access token
 * @returns {DecodedToken|null} Decoded token payload or null if invalid
 */
export function verifyAccessToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Refresh tokens using a refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<TokenResponse|null>} New tokens or null if invalid
 */
export async function refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
  try {
    // Calculate refresh token hash
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Find token in database
    const tokenRecord = await db.select().from(authTokens).where(
      and(
        eq(authTokens.refreshHash, refreshHash),
        gt(authTokens.expiresAt, new Date())
      )
    ).limit(1);
    
    if (!tokenRecord || tokenRecord.length === 0) {
      console.warn('Refresh token not found or expired');
      return null;
    }
    
    const token = tokenRecord[0];
    
    // Delete the used refresh token (token rotation)
    await db.delete(authTokens).where(eq(authTokens.id, token.id));
    
    // Generate new tokens
    return generateTokens(token.userId);
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Invalidate refresh token (logout)
 * @param {string} refreshToken - Refresh token to invalidate
 * @returns {Promise<boolean>} Success status
 */
export async function invalidateToken(refreshToken: string): Promise<boolean> {
  try {
    // Calculate refresh token hash
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Delete token from database
    const result = await db.delete(authTokens).where(eq(authTokens.refreshHash, refreshHash));
    
    return true;
  } catch (error) {
    console.error('Error invalidating token:', error);
    return false;
  }
}

/**
 * Extract JWT token from authorization header
 * @param {NextRequest} req - Next.js request object
 * @returns {string|null} JWT token or null if not found
 */
export function extractTokenFromHeader(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.split(' ')[1];
}

/**
 * Auth middleware for Next.js App Router
 * @param {NextRequest} req - Next.js request object
 * @returns {NextResponse|null} Response object if unauthorized, null to continue
 */
export function authMiddleware(req: NextRequest): NextResponse | null {
  // Check for X-User-Id header from Kong API Gateway
  const userId = req.headers.get('X-User-Id');
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized: Missing user ID' }, { status: 401 });
  }
  
  // Attach user ID to request for downstream processing
  req.user = { id: userId };
  
  // Continue with the request
  return null;
}

/**
 * Sign in with a provider (GitHub).
 * Initiates OAuth flow with the specified provider.
 * 
 * @param {string} provider - Authentication provider (e.g. 'github')
 * @param {object} options - Additional options
 * @param {string} options.redirectTo - URL to redirect after authentication
 * @returns {Promise<void>}
 */
export async function signIn(provider: string, options?: { redirectTo?: string }): Promise<void> {
  // Store the redirect URL in a cookie for retrieval after OAuth callback
  if (options?.redirectTo) {
    const cookieStore = await cookies();
    cookieStore.set('auth-redirect', options.redirectTo, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10 // 10 minutes
    });
  }

  // GitHub OAuth endpoints
  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('GitHub client ID is not configured');
    }
    
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/github`;
    const scope = 'read:user user:email';
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    
    redirect(authUrl);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
