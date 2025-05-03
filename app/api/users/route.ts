/**
 * API Routes for user management
 * Handles creating users and getting user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';
import { EscrowManager } from '@/lib/escrow-lib';

// User type enum for API (не экспортируется, т.к. это вызывает ошибку в маршруте Next.js)
enum UserType {
  CUSTOMER = 'CUSTOMER',
  CONTRACTOR = 'CONTRACTOR',
  PLATFORM = 'PLATFORM'
}

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for user creation
const createUserSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  type: z.enum([UserType.CUSTOMER, UserType.CONTRACTOR, UserType.PLATFORM]),
  initialBalance: z.number().optional().default(0)
});

// Using real escrow manager instead of mock database

// POST /api/users - Create a new user
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
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
    const newUser = await escrowManager.createUser(
      name,
      email,
      type,
      initialBalance ? initialBalance.toString() : '0'
    );
    
    return corsResponse(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return corsResponse(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}));

// GET /api/users - Get all users
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  try {
    // Log entry into the handler and the received auth context (if any)
    const auth = (request as any).auth; // Cast to any to access potentially attached auth
    console.log(`Entering GET /api/users handler. Auth context: ${JSON.stringify(auth)}`);
    
    // Use escrow manager to get all users from the service
    const users = await escrowManager.getAllUsers();
    return corsResponse(users);
  } catch (error: any) {
    console.error('Error getting users:', error);
    return corsResponse(
      { error: error.message || 'Failed to get users' },
      { status: 500 }
    );
  }
}));
