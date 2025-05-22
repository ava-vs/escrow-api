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

// POST /api/users/public - Create a new user (publicly)
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
    
    // Create user using escrow manager service
    // Ensure the type used here is consistent with what public registration should create
    const newUser = await escrowManager.createUser(
      name,
      email,
      type, // UserType from schema (defaults to CUSTOMER)
      initialBalance ? initialBalance.toString() : '0'
    );
    
    // Consider what to return. For public registration, maybe just a success message or limited user info.
    return corsResponse({ message: 'User created successfully', userId: newUser.id }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user via public endpoint:', error);
    // Avoid leaking too much info in public error messages
    if (error.message && error.message.includes('User with this email already exists')) {
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
});

// Optional: Add a GET handler if needed for this public path, or return 405 Method Not Allowed
export async function GET(request: NextRequest) {
  return corsResponse({ message: 'Method Not Allowed. Use POST to create a user.' }, { status: 405 });
} 