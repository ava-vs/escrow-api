/**
 * API Routes for voting for a representative in a group order
 * Handles the voting process in group orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for representative voting
const voteForRepresentativeSchema = z.object({
  voterId: z.string().uuid({ message: 'Valid voter ID is required' }),
  candidateId: z.string().uuid({ message: 'Valid candidate ID is required' })
});

// POST /api/orders/[id]/vote - Vote for a representative
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
    const validation = voteForRepresentativeSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { voterId, candidateId } = validation.data;
    
    // Get the order to check if it's a group order
    const order = await escrowManager.getOrder(orderId);
    if (!order.isGroupOrder) {
      return corsResponse(
        { error: 'Voting is only available for group orders' },
        { status: 400 }
      );
    }
    
    // Vote for representative
    await escrowManager.voteForRepresentative(
      orderId,
      voterId,
      candidateId
    );
    
    // Get the updated order to return the current representative
    const updatedOrder = await escrowManager.getOrder(orderId);
    
    // Get all votes for this order to provide more context
    const votes = await escrowManager.getVotesForOrder(orderId);
    
    return corsResponse({
      success: true,
      orderId,
      currentRepresentativeId: updatedOrder.representativeId,
      votes: votes
    });
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error voting for representative in order ${id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('not a customer of this order')) {
      return corsResponse(
        { error: 'User is not a customer of this order' },
        { status: 403 }
      );
    }
    
    if (error.message?.includes('cannot vote for themselves')) {
      return corsResponse(
        { error: 'Users cannot vote for themselves' },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to vote for representative' },
      { status: 500 }
    );
  }
}));
