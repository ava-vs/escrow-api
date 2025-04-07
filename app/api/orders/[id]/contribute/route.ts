/**
 * API Routes for contributing funds to an order
 * Handles the fund contribution process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for fund contribution
const contributeFundsSchema = z.object({
  contributingUserId: z.string().uuid({ message: 'Valid user ID is required' }),
  amount: z.number().positive({ message: 'Amount must be positive' })
});

// POST /api/orders/[id]/contribute - Contribute funds to order
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
    
    // Validate request body
    const validation = contributeFundsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { contributingUserId, amount } = validation.data;
    
    // Contribute funds to order
    const updatedOrder = await escrowManager.contributeFunds(
      orderId,
      contributingUserId,
      amount.toString() // Преобразуем число в строку, как ожидает escrowManager
    );
    
    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error contributing funds to order ${id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('Insufficient balance')) {
      return NextResponse.json(
        { error: 'Insufficient balance for the requested operation' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to contribute funds' },
      { status: 500 }
    );
  }
}
