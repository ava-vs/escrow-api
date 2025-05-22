/**
 * Email check endpoint for authentication
 * Checks if email exists in the database without requiring authentication
 */

import { NextResponse } from 'next/server';
import { db } from '../../../../db/db.js';
import { users } from '../../../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Check if email exists in the database
 * POST /api/auth/check-email
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;
    
    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Find user by email
    const foundUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    
    // Return whether the email exists
    return NextResponse.json({
      exists: foundUsers.length > 0
    });
  } catch (error) {
    console.error('Email check error:', error);
    return NextResponse.json(
      { error: 'Email check failed' },
      { status: 500 }
    );
  }
}

/**
 * Check if email exists in the database via GET request
 * GET /api/auth/check-email?email=user@example.com
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email query parameter is required' },
        { status: 400 }
      );
    }
    
    const foundUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    
    return NextResponse.json({
      exists: foundUsers.length > 0
    });
  } catch (error) {
    console.error('Email check (GET) error:', error);
    return NextResponse.json(
      { error: 'Email check failed' },
      { status: 500 }
    );
  }
}