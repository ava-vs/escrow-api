/**
 * API Routes for user balance operations
 * Handles updating user balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await request.json();
    
    // Validate request body
    const validation = updateBalanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { amount } = validation.data;
    
    // Verify user exists
    const userExists = await escrowManager.getUser(userId);
    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user balance
    const updatedUser = await escrowManager.updateUserBalance(userId, amount);
    
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error(`Error updating balance for user ${params.id}:`, error);
    
    // Handle specific errors with appropriate status codes
    if (error.message === 'Insufficient balance') {
      return NextResponse.json(
        { error: 'Insufficient balance for the requested operation' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update user balance' },
      { status: 500 }
    );
  }
}
