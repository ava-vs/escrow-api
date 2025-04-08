/**
 * API Routes for user management
 * Handles creating users and getting user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, corsResponse } from '@/lib/cors';

// User type enum for API
export enum UserType {
  CUSTOMER = 'CUSTOMER',
  CONTRACTOR = 'CONTRACTOR',
  PLATFORM = 'PLATFORM'
}

// Schema for user creation
const createUserSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  type: z.enum([UserType.CUSTOMER, UserType.CONTRACTOR, UserType.PLATFORM]),
  initialBalance: z.number().optional().default(0)
});

// Mock user database for API demo
const mockUsers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    type: UserType.CUSTOMER,
    balance: '1000'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    type: UserType.CONTRACTOR,
    balance: '2000'
  }
];

// POST /api/users - Create a new user
export const POST = withCors(async function POST(request: NextRequest) {
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
    
    // Create mock user
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      name,
      email,
      type,
      balance: initialBalance ? initialBalance.toString() : '0'
    };
    
    // Add to mock database
    mockUsers.push(newUser);
    
    return corsResponse(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return corsResponse(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
});

// GET /api/users - Get all users
export const GET = withCors(async function GET() {
  try {
    // Return mock users from our database
    return corsResponse(mockUsers);
  } catch (error: any) {
    console.error('Error getting users:', error);
    return corsResponse(
      { error: error.message || 'Failed to get users' },
      { status: 500 }
    );
  }
});
