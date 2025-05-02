/**
 * API Routes for Interest-Only functionality
 * Handles toggling user interest in orders and getting interest information
 */

import { AuthenticatedRequest } from '@/lib/escrow-lib/interfaces';
import { z } from 'zod';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';
import { EscrowManager } from '@/lib/escrow-lib';

// Schema for toggling interest
const toggleInterestSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
});

// Schema for getting interested users for an order
const getInterestedUsersSchema = z.object({
  orderId: z.string().min(1, { message: 'Order ID is required' }),
});

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/orders/interest-only - Get all orders that the current user is interested in
export const GET = withCors(withApiAuth(async function GET(request: AuthenticatedRequest) {
  try {
    // Extract the user ID from the auth context
    const auth = request.auth;
    const userId = auth?.id;
    
    if (!userId) {
      return corsResponse({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get all orders the user is interested in using the escrow manager
    const interestedOrders = await escrowManager.getInterestedOrders(userId);
    const interestedOrderIds = interestedOrders.map(order => order.id);
    
    return corsResponse({ interestedOrderIds });
  } catch (error: any) {
    console.error('Error fetching interested orders:', error);
    return corsResponse(
      { error: error.message || 'Failed to fetch interested orders' },
      { status: 500 }
    );
  }
}));

// POST /api/orders/interest-only - Toggle interest for current user on an order
export const POST = withCors(withApiAuth(async function POST(request: AuthenticatedRequest) {
  try {
    // Extract the user ID from the auth context
    const auth = request.auth;
    const userId = auth?.id;
    
    if (!userId) {
      return corsResponse({ error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validate request body
    const validation = toggleInterestSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { orderId } = validation.data;
    
    // Use the escrow manager to toggle interest
    const result = await escrowManager.toggleInterest(userId, orderId);
    
    return corsResponse(result);
  } catch (error: any) {
    console.error('Error toggling interest:', error);
    return corsResponse(
      { error: error.message || 'Failed to toggle interest' },
      { status: 500 }
    );
  }
}));

// OPTIONS for CORS preflight requests
export const OPTIONS = withCors(async function OPTIONS() {
  return corsResponse({}, { status: 200 });
});
