/**
 * API Routes for document approval
 * Handles the document approval process
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// Schema for document approval
const approveDocumentSchema = z.object({
  approverId: z.string().uuid({ message: 'Valid approver ID is required' })
});

// POST /api/documents/[id]/approve - Approve a document
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const documentId = context.params.id;
    const body = await request.json();
    
    // Validate request body
    const validation = approveDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { approverId } = validation.data;
    
    // Approve document
    const document = await escrowManager.approveDocument(documentId, approverId);
    
    return NextResponse.json(document);
  } catch (error: any) {
    console.error(`Error approving document ${context.params.id}:`, error);
    
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('already approved')) {
      return NextResponse.json(
        { error: 'Document already approved by this user' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to approve document' },
      { status: 500 }
    );
  }
}
