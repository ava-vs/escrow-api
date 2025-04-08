/**
 * API Routes for user balance operations
 * Handles updating user balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for balance update
const updateBalanceSchema = z.object({
  amount: z.number({ 
    required_error: 'Amount is required',
    invalid_type_error: 'Amount must be a number'
  })
});

// PATCH /api/users/[id]/balance - Update user balance
export const PATCH = withCors(withApiAuth(async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Extract ID from the URL path
    if (!id) {
      return corsResponse(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }
    const userId = id;
    const body = await request.json();
    
    // Validate request body
    const validation = updateBalanceSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { amount } = validation.data;
    
    // Verify user exists
    const userExists = await escrowManager.getUser(userId);
    if (!userExists) {
      return corsResponse(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user balance
    const updatedUser = await escrowManager.updateUserBalance(userId, amount.toString()); // Convert number to string as expected by the API
    
    return corsResponse(updatedUser);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error updating balance for user ${id}:`, error);
    
    // Handle specific errors with appropriate status codes
    if (error.message === 'Insufficient balance') {
      return corsResponse(
        { error: 'Insufficient balance for the requested operation' },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to update user balance' },
      { status: 500 }
    );
  }
}));
