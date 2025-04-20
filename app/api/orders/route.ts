/**
 * API Routes for order management
 * Handles creating and retrieving orders
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
  amount: z.number().positive({ message: 'Amount must be positive' }),
  deadline: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Deadline must be a valid date string' }
  ),
  roadmapPhaseId: z.string().optional()
});

// Schema for order creation
const createOrderSchema = z.object({
  customerId: z.string().uuid({ message: 'Valid customer ID is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string().min(1, { message: 'Description is required' }),
  milestones: z.array(milestoneSchema).min(1, { message: 'At least one milestone is required' })
});

// POST /api/orders - Create a new order
export const POST = withCors(withApiAuth(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return corsResponse(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { customerId, title, description, milestones } = validation.data;
    
    // Create order
    const order = await escrowManager.createOrder(
      customerId,
      title,
      description,
      milestones.map(m => ({
        ...m,
        amount: m.amount.toString(), // Convert number to string as expected by the API
        deadline: new Date(m.deadline)
      }))
    );
    
    return corsResponse(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not a Customer')) {
      return corsResponse(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}));

// GET /api/orders - Get all orders
export const GET = withCors(withApiAuth(async function GET() {
  try {
    // Используем EscrowManager для получения всех заказов
    const orders = await escrowManager.getAllOrders();
    return corsResponse(orders);
  } catch (error: any) {
    console.error('Error getting orders:', error);
    return corsResponse(
      { error: error.message || 'Failed to get orders' },
      { status: 500 }
    );
  }
}));
