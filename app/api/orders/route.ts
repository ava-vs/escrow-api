/**
 * API Routes for order management
 * Handles creating and retrieving orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
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
        deadline: new Date(m.deadline)
      }))
    );
    
    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not a Customer')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}

// GET /api/orders - Get all orders
export async function GET() {
  try {
    const orders = await escrowManager.getAllOrders();
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Error getting orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get orders' },
      { status: 500 }
    );
  }
}
