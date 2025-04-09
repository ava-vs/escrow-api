/**
 * API Route for updating order funded amount
 * Used for adding or subtracting funds from an order's funded amount
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for updating order funded amount
const updateFundedAmountSchema = z.object({
  amount: z.number().positive({ message: 'Amount must be a positive number' }),
  isDebit: z.boolean().optional().default(false)
});

// PATCH /api/orders/[id]/funded-amount - Update order funded amount
export const PATCH = withCors(withApiAuth(async function PATCH(request: NextRequest) {
  try {
    // Extract order ID from URL
    const orderId = request.nextUrl.pathname.split('/')[3];
    
    if (!orderId) {
      return corsResponse(
        { error: 'Missing order ID' },
        { status: 400 }
      );
    }
    
    // Extract amount and isDebit from body
    const body = await request.json();
    
    // Validate request body
    const validation = updateFundedAmountSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { amount, isDebit } = validation.data;
    
    // @ts-ignore: метод существует, но TypeScript его не видит
    const updatedOrder = await escrowManager.updateOrderFundedAmount(
      orderId,
      amount,
      isDebit
    );
    
    return corsResponse(updatedOrder);
  } catch (error: any) {
    console.error(`Error updating order funded amount:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('Insufficient funds')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to update order funded amount' },
      { status: 500 }
    );
  }
}));
