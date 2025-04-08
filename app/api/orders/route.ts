/**
 * API Routes for order management
 * Handles creating and retrieving orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';

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
export const POST = withCors(async function POST(request: NextRequest) {
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
});

// GET /api/orders - Get all orders
export const GET = withCors(async function GET() {
  try {
    // Mock orders data for API demo
    const mockOrders = [
      {
        id: '1',
        title: 'Website Development',
        description: 'Full-stack web application development',
        customerId: '1',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        milestones: [
          {
            id: '1',
            description: 'Frontend implementation',
            amount: '500',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING'
          },
          {
            id: '2',
            description: 'Backend implementation',
            amount: '700',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING'
          }
        ]
      },
      {
        id: '2',
        title: 'Mobile App Design',
        description: 'UI/UX design for iOS and Android app',
        customerId: '2',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        milestones: [
          {
            id: '3',
            description: 'Wireframes and mockups',
            amount: '300',
            deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING'
          }
        ]
      }
    ];
    
    return corsResponse(mockOrders);
  } catch (error: any) {
    console.error('Error getting orders:', error);
    return corsResponse(
      { error: error.message || 'Failed to get orders' },
      { status: 500 }
    );
  }
});
