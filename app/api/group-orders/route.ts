/**
 * API Routes for group order management
 * Handles creating and retrieving group orders with multiple customers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for milestone input
const milestoneSchema = z.object({
  description: z.string().min(1, { message: 'Description is required' }),
  // Changed from number to string to match updated interfaces
  amount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: 'Amount must be a valid positive number' }
  ),
  deadline: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Deadline must be a valid date string' }
  ),
  roadmapPhaseId: z.string().optional()
});

// Schema for group order creation
const createGroupOrderSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(2, { 
    message: 'At least two customer IDs are required for a group order' 
  }),
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string().min(1, { message: 'Description is required' }),
  milestones: z.array(milestoneSchema).min(1, { 
    message: 'At least one milestone is required' 
  }),
  initialRepresentativeId: z.string().uuid().optional()
});


// POST /api/group-orders - Create a new group order
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createGroupOrderSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { 
      customerIds, 
      title, 
      description, 
      milestones,
      initialRepresentativeId 
    } = validation.data;
    
    // Create group order
    const order = await escrowManager.createGroupOrder(
      customerIds,
      title,
      description,
      milestones.map(m => ({
        ...m,
        // Using amount as string as per updated interfaces
        amount: m.amount.toString(), // Ensure amount is a string
        deadline: new Date(m.deadline)
      })),
      initialRepresentativeId
    );
    
    return corsResponse(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not a Customer')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to create group order' },
      { status: 500 }
    );
  }
}));

// GET /api/group-orders - Get all orders or orders for a specific customer
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    let orders;
    if (customerId) {
      // Get orders for specific customer
      orders = await escrowManager.getOrdersByCustomer(customerId);
      // Filter to only return group orders
      orders = orders.filter(order => order.isGroupOrder);
    } else {
      // Get all orders and filter to only return group orders
      orders = await escrowManager.getAllOrders();
      orders = orders.filter(order => order.isGroupOrder);
    }
    
    return corsResponse(orders, { status: 200 });
  } catch (error: any) {
    console.error('Error retrieving group orders:', error);
    return corsResponse(
      { error: error.message || 'Failed to retrieve group orders' },
      { status: 500 }
    );
  }
}));






