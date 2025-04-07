/**
 * API Routes for specific order operations
 * Handles retrieving, updating, and managing a specific order
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/orders/[id] - Get order by ID
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Extract ID from the URL path
    if (!id) {
      return NextResponse.json(
        { error: 'Missing order ID' },
        { status: 400 }
      );
    }
    const orderId = id;
    
    // Get order by ID
    const order = await escrowManager.getOrder(orderId);
    
    return NextResponse.json(order);
  } catch (error: any) {
    const id = request.nextUrl.pathname.split('/')[3] || 'unknown';
    console.error(`Error getting order ${id}:`, error);
    
    // Handle not found error
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to get order' },
      { status: 500 }
    );
  }
}
