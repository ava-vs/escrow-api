/**
 * API Route for rejecting an act of work
 * Handles requests to reject an act by a specific user with a reason
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// POST /api/acts/[id]/reject - Reject an act
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
  try {
    // Extract act ID from URL
    const id = request.nextUrl.pathname.split('/')[3];
    if (!id) {
      return corsResponse(
        { error: 'Missing act ID' },
        { status: 400 }
      );
    }
    
    // Extract user ID and reason from body
    const body = await request.json();
    const { userId, reason } = body;
    
    if (!userId) {
      return corsResponse(
        { error: 'Missing userId in request body' },
        { status: 400 }
      );
    }
    
    if (!reason) {
      return corsResponse(
        { error: 'Missing rejection reason in request body' },
        { status: 400 }
      );
    }
    
    // Reject the act
    const rejectedAct = await escrowManager.rejectAct(id, userId, reason);
    
    return corsResponse(rejectedAct);
  } catch (error: any) {
    console.error(`Error rejecting act:`, error);
    
    // Handle not found errors
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: error.message },
        { status: 404 }
      );
    }
    
    // Handle already rejected errors
    if (error.message?.includes('already rejected')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to reject act' },
      { status: 500 }
    );
  }
}));
