/**
 * API Routes for contributing funds to an order
 * Handles the fund contribution process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for fund contribution
const contributeFundsSchema = z.object({
  contributingUserId: z.string().uuid({ message: 'Valid user ID is required' }),
  amount: z.number().positive({ message: 'Amount must be positive' })
});

// POST /api/orders/[id]/contribute - Contribute funds to order
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Extract ID from the URL path
    if (!id) {
      return corsResponse(
        { error: 'Missing order ID' },
        { status: 400 }
      );
    }
    const orderId = id;
    const body = await request.json();
    
    // Validate request body
    const validation = contributeFundsSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
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
    
    return corsResponse(updatedOrder);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error contributing funds to order ${id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('Insufficient balance')) {
      return corsResponse(
        { error: 'Insufficient balance for the requested operation' },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to contribute funds' },
      { status: 500 }
    );
  }
}));
