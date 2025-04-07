/**
 * API Routes for voting for representatives in a group order
 * Handles voting and representative selection process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for representative voting
const voteForRepresentativeSchema = z.object({
  voterId: z.string().uuid({ message: 'Invalid voter ID format' }),
  candidateId: z.string().uuid({ message: 'Invalid candidate ID format' })
});

// POST /api/group-orders/:id/vote - Vote for a representative in a group order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    
    // Validate order ID and request body
    const orderIdValidation = z.string().uuid({ message: 'Invalid order ID format' }).safeParse(orderId);
    const bodyValidation = voteForRepresentativeSchema.safeParse(body);
    
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
    
    const { voterId, candidateId } = bodyValidation.data;
    
    // Vote for representative
    await escrowManager.voteForRepresentative(orderId, voterId, candidateId);
    
    // Get the updated order to return
    const updatedOrder = await escrowManager.getOrder(orderId);
    
    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error: any) {
    console.error('Error voting for representative in group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Group order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('not a group order')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('not a customer')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to vote for representative' },
      { status: 500 }
    );
  }
}
