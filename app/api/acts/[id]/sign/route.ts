/**
 * API Route for signing an act of work
 * Handles requests to sign an act by a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// POST /api/acts/[id]/sign - Sign an act
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
    
    // Extract user ID from body
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return corsResponse(
        { error: 'Missing userId in request body' },
        { status: 400 }
      );
    }
    
    // Sign the act
    const signedAct = await escrowManager.signAct(id, userId);
    
    return corsResponse(signedAct);
  } catch (error: any) {
    console.error(`Error signing act:`, error);
    
    // Handle not found errors
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: error.message },
        { status: 404 }
      );
    }
    
    // Handle already signed errors
    if (error.message?.includes('already signed')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to sign act' },
      { status: 500 }
    );
  }
}));
