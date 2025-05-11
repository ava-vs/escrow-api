/**
 * Auth API Routes for Escrow API
 * Implements /login, /refresh and /logout endpoints
 */

import { NextResponse } from 'next/server';
import { db } from '../../../db/db.js';
import { users } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateTokens, refreshTokens, invalidateToken, verifyAccessToken } from '../../../lib/auth.ts';
import bcrypt from 'bcrypt';

/**
 * Login endpoint
 * POST /api/auth/login
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Find user by email
    const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (foundUsers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    const user = foundUsers[0];
    
    // Verify password
    // Note: Using bcrypt.compare for secure password verification
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);
    
    // Set refresh token in HTTP-only cookie
    const response = NextResponse.json({
      userId: user.id,
      email: user.email,
      accessToken
    });
    
    // Set the refresh token as HTTP-only cookie
    response.cookies.set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Token refresh endpoint
 * POST /api/auth/refresh
 */
export async function PUT(request) {
  try {
    // Get refresh token from cookies
    const refreshToken = request.cookies.get('refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }
    
    // Refresh tokens
    const tokens = await refreshTokens(refreshToken);
    
    if (!tokens) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }
    
    // Return new access token and set new refresh token in cookie
    const response = NextResponse.json({
      accessToken: tokens.accessToken
    });
    
    // Set the new refresh token as HTTP-only cookie
    response.cookies.set({
      name: 'refresh_token',
      value: tokens.refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
    });
    
    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
export async function DELETE(request) {
  try {
    // Get refresh token from cookies
    const refreshToken = request.cookies.get('refresh_token')?.value;
    
    if (refreshToken) {
      // Invalidate the refresh token
      await invalidateToken(refreshToken);
    }
    
    // Clear the refresh token cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'refresh_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0 // Expire immediately
    });
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
