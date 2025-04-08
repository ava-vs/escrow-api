/**
 * API Routes for specific user operations
 * Handles getting user by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/users/[id] - Get user by ID
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Extract ID from the URL path
    if (!id) {
      return corsResponse(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }
    const userId = id;
    
    // Get user by ID
    const user = await escrowManager.getUser(userId);
    
    if (!user) {
      return corsResponse(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return corsResponse(user);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error getting user ${id}:`, error);
    return corsResponse(
      { error: error.message || 'Failed to get user' },
      { status: 500 }
    );
  }
}));
