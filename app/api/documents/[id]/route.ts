/**
 * API Routes for specific document operations
 * Handles retrieving and managing a specific document
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/documents/[id] - Get document by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Get document by ID
    const document = await escrowManager.getDocument(documentId);
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(document);
  } catch (error: any) {
    console.error(`Error getting document ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to get document' },
      { status: 500 }
    );
  }
}
