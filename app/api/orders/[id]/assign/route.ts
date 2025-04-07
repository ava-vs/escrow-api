/**
 * API Routes for assigning contractor to order
 * Handles contractor assignment process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for contractor assignment
const assignContractorSchema = z.object({
  contractorId: z.string().uuid({ message: 'Valid contractor ID is required' }),
  assignerUserId: z.string().uuid({ message: 'Valid assigner user ID is required' })
});

// PATCH /api/orders/[id]/assign - Assign contractor to order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    
    // Validate request body
    const validation = assignContractorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { contractorId, assignerUserId } = validation.data;
    
    // Assign contractor to order
    const updatedOrder = await escrowManager.assignContractor(
      orderId,
      contractorId,
      assignerUserId
    );
    
    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error(`Error assigning contractor to order ${params.id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Order not found' },
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
        { error: 'Not authorized to assign contractor' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to assign contractor' },
      { status: 500 }
    );
  }
}
