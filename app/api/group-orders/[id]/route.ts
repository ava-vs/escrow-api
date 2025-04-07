/**
 * API Routes for specific group order operations
 * Handles retrieving, updating and managing a single group order
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/group-orders/:id - Get a specific group order by ID
export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    
    // Validate order ID format
    const validation = z.string().uuid({ message: 'Invalid order ID format' }).safeParse(orderId);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }
    
    const order = await escrowManager.getOrder(orderId);
    
    // Verify this is a group order
    if (!order.isGroupOrder) {
      return NextResponse.json(
        { error: 'Order is not a group order' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(order, { status: 200 });
  } catch (error: any) {
    console.error('Error retrieving group order:', error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Group order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve group order' },
      { status: 500 }
    );
  }
}
