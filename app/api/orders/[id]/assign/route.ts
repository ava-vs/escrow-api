/**
 * API Routes for assigning contractor to order
 * Handles contractor assignment process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for contractor assignment
const assignContractorSchema = z.object({
  contractorId: z.string().uuid({ message: 'Valid contractor ID is required' }),
  assignerUserId: z.string().uuid({ message: 'Valid assigner user ID is required' })
});

// PATCH /api/orders/[id]/assign - Assign contractor to order
export const PATCH = withCors(withApiAuth(async function PATCH(request: NextRequest) {
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
    const validation = assignContractorSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
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
    
    return corsResponse(updatedOrder);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error assigning contractor to order ${id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('not a Contractor')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('not authorized')) {
      return corsResponse(
        { error: 'Not authorized to assign contractor' },
        { status: 403 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to assign contractor' },
      { status: 500 }
    );
  }
}));
