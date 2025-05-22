/**
 * API Route for admin functionality to get users interested in a specific order
 */

import { NextRequest } from 'next/server';
import { AuthenticatedRequest } from '@/lib/escrow-lib/interfaces';
import { z } from 'zod';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for getting interested users for an order
const getInterestedUsersSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
});

// OPTIONS for CORS preflight requests
export const OPTIONS = withCors(async function OPTIONS() {
  return corsResponse({}, { status: 200 });
});

// GET /api/orders/interest-only/users?orderId={orderId} 
// Get all users interested in a specific order (admin only)
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  try {
    // Extract the user ID from the auth context
    const authenticatedRequest = request as AuthenticatedRequest;
    const auth = authenticatedRequest.auth;
    const userId = auth?.id;
    
    if (!userId) {
      return corsResponse({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return corsResponse(
        { error: 'Order ID is required as a query parameter' },
        { status: 400 }
      );
    }
    
    // Validate orderId
    const validation = getInterestedUsersSchema.safeParse({ orderId });
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid order ID', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    // TODO: In a real implementation, we would check if the user has admin access to this order
    // For now, we'll just get the list of interested users
    
    // Get all users interested in this order using escrow manager
    const interestedUsers = await escrowManager.getInterestedUsers(orderId);
    
    return corsResponse({
      orderId,
      interestedUsers,
      count: interestedUsers.length
    });
  } catch (error: any) {
    console.error('Error fetching interested users:', error);
    return corsResponse(
      { error: error.message || 'Failed to fetch interested users' },
      { status: 500 }
    );
  }
}));
