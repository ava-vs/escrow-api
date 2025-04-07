/**
 * API Routes for group order management
 * Handles creating group orders with multiple customers
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createGroupOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
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
        deadline: new Date(m.deadline)
      })),
      initialRepresentativeId
    );
    
    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not a Customer')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create group order' },
      { status: 500 }
    );
  }
}
