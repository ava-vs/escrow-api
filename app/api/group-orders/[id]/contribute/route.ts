/**
 * API Routes for contributing funds to a group order
 * Handles financial operations for group orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for funds contribution
const contributeFundsSchema = z.object({
  contributingUserId: z.string().uuid({ message: 'Invalid user ID format' }),
  amount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: 'Amount must be a valid positive number' }
  )
});

// POST /api/group-orders/:id/contribute - Contribute funds to a group order
export async function POST(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Extract ID from the URL path
    if (!id) {
      return NextResponse.json(
        { error: 'Missing order ID' },
        { status: 400 }
      );
    }
    const orderId = id;
    const body = await request.json();
    
    // Validate order ID and request body
    const orderIdValidation = z.string().uuid({ message: 'Invalid order ID format' }).safeParse(orderId);
    const bodyValidation = contributeFundsSchema.safeParse(body);
    
    if (!orderIdValidation.success) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }
    
    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: bodyValidation.error.format() },
        { status: 400 }
      );
    }
    
    const { contributingUserId, amount } = bodyValidation.data;
    
    // Contribute funds to order
    const order = await escrowManager.contributeFunds(orderId, contributingUserId, amount);
    
    return NextResponse.json(order, { status: 200 });
  } catch (error: any) {
    console.error('Error contributing funds to group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Group order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('insufficient')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to contribute funds to group order' },
      { status: 500 }
    );
  }
}
