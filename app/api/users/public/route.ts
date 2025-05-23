/**
 * API Route for public user registration
 * Handles creating users without requiring prior authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, corsResponse } from '@/lib/cors'; // Assuming cors.ts is in lib
// import { withApiAuth } from '@/lib/api-auth'; // No auth for public registration
import { EscrowManager } from '@/lib/escrow-lib'; // Assuming escrow-lib.ts is in lib

// User type enum for API 
// Duplicated from /api/users/route.ts or should be moved to a shared location
enum UserType {
  CUSTOMER = 'CUSTOMER',
  CONTRACTOR = 'CONTRACTOR',
  PLATFORM = 'PLATFORM'
}

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for user creation (same as in /api/users/route.ts)
const createUserSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  type: z.enum([UserType.CUSTOMER, UserType.CONTRACTOR, UserType.PLATFORM]).optional().default(UserType.CUSTOMER), // Default to CUSTOMER for public signups
  initialBalance: z.number().optional().default(0)
});

// POST /api/users/public - Create or get existing user (publicly)
export const POST = withCors(async function POST(request: NextRequest) { // No withApiAuth
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { name, email, type, initialBalance } = validation.data;
    
    // First, check if user already exists by email
    let existingUser;
    try {
      existingUser = await escrowManager.getUserByEmail(email);
    } catch (error) {
      console.error('Error checking existing user:', error);
      // Continue to try creating new user if check fails
    }
    
    if (existingUser) {
      // User already exists, return existing user data
      console.log(`User with email ${email} already exists, returning existing user`);
      return corsResponse({ 
        message: 'User already exists', 
        userId: existingUser.id,
        user: existingUser 
      }, { status: 200 });
    }
    
    // User doesn't exist, create a new one
    try {
      const newUser = await escrowManager.createUser(
        name,
        email,
        type, // UserType from schema (defaults to CUSTOMER)
        initialBalance ? initialBalance.toString() : '0'
      );
      
      console.log(`Created new user with email ${email}, ID: ${newUser.id}`);
      return corsResponse({ 
        message: 'User created successfully', 
        userId: newUser.id,
        user: newUser 
      }, { status: 201 });
    } catch (createError: any) {
      console.error('Error creating user via public endpoint:', createError);
      
      // Handle specific error cases
      if (createError.message && createError.message.includes('User with this email already exists')) {
        // This shouldn't happen since we checked above, but handle race condition
        try {
          const raceConditionUser = await escrowManager.getUserByEmail(email);
          if (raceConditionUser) {
            return corsResponse({
              message: 'User already exists',
              userId: raceConditionUser.id,
              user: raceConditionUser
            }, { status: 200 });
          }
        } catch (retryError) {
          console.error('Error in race condition retry:', retryError);
        }
        
        return corsResponse(
          { error: 'User with this email already exists' },
          { status: 409 } // Conflict
        );
      }
      
      return corsResponse(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in public user endpoint:', error);
    return corsResponse(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Optional: Add a GET handler if needed for this public path, or return 405 Method Not Allowed
export async function GET(request: NextRequest) {
  return corsResponse({ message: 'Method Not Allowed. Use POST to create a user.' }, { status: 405 });
} 