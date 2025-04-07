/**
 * API Routes for document management
 * Handles document creation and retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager, DocumentType } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for document creation
const createDocumentSchema = z.object({
  orderId: z.string().uuid({ message: 'Valid order ID is required' }),
  type: z.enum([
    DocumentType.DEFINITION_OF_READY,
    DocumentType.ROADMAP,
    DocumentType.DEFINITION_OF_DONE,
    DocumentType.SPECIFICATION,
    DocumentType.DELIVERABLE
  ], { message: 'Valid document type is required' }),
  name: z.string().min(1, { message: 'Name is required' }),
  createdBy: z.string().uuid({ message: 'Valid creator ID is required' }),
  content: z.any()
});

// POST /api/documents - Create a new document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { orderId, type, name, createdBy, content } = validation.data;
    
    // Create document
    const document = await escrowManager.createDocument(
      orderId,
      type,
      name,
      createdBy,
      content
    );
    
    return NextResponse.json(document, { status: 201 });
  } catch (error: any) {
    console.error('Error creating document:', error);
    
    // Handle specific error cases
    if (error.message?.includes('Order not found')) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create document' },
      { status: 500 }
    );
  }
}
