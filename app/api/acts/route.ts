/**
 * API Routes for Act of Work operations
 * Handles creating and managing acts
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// POST /api/acts - Create a new act
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, milestoneId, deliverableIds, createdBy, name } = body;
    
    // Validate required fields
    if (!orderId || !milestoneId || !deliverableIds || !createdBy || !name) {
      return corsResponse(
        { error: 'Missing required fields. Requires: orderId, milestoneId, deliverableIds, createdBy, name' },
        { status: 400 }
      );
    }
    
    // Create the act
    const act = await escrowManager.createAct(
      orderId,
      milestoneId,
      deliverableIds,
      createdBy,
      name
    );
    
    return corsResponse(act, { status: 201 });
  } catch (error: any) {
    console.error('Error creating act:', error);
    
    // Handle not found errors
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to create act' },
      { status: 500 }
    );
  }
}));

// GET /api/acts - List all acts
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  try {
    // This endpoint could be implemented to list all acts
    // But for now, we'll return a not implemented response
    return corsResponse(
      { error: 'Listing all acts is not implemented' },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('Error listing acts:', error);
    
    return corsResponse(
      { error: error.message || 'Failed to list acts' },
      { status: 500 }
    );
  }
}));
