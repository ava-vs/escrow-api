/**
 * API Routes for assigning contractors to a group order
 * Handles contractor assignment operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for contractor assignment
const assignContractorSchema = z.object({
  contractorId: z.string().uuid({ message: 'Invalid contractor ID format' }),
  assignerUserId: z.string().uuid({ message: 'Invalid assigner user ID format' })
});

// POST /api/group-orders/:id/assign-contractor - Assign contractor to a group order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    
    // Validate order ID and request body
    const orderIdValidation = z.string().uuid({ message: 'Invalid order ID format' }).safeParse(orderId);
    const bodyValidation = assignContractorSchema.safeParse(body);
    
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
    
    const { contractorId, assignerUserId } = bodyValidation.data;
    
    // Assign contractor to order
    const order = await escrowManager.assignContractor(orderId, contractorId, assignerUserId);
    
    return NextResponse.json(order, { status: 200 });
  } catch (error: any) {
    console.error('Error assigning contractor to group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Group order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('not a Contractor')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('not authorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to assign contractor to group order' },
      { status: 500 }
    );
  }
}
