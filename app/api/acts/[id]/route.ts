/**
 * API Route for getting specific act information
 * Handles retrieving an act by its ID
 */

import { NextRequest } from 'next/server';
import { EscrowManager } from '@/lib/escrow-lib';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

// Initialize the escrow manager
const escrowManager = new EscrowManager();

// GET /api/acts/[id] - Get act by ID
export const GET = withCors(withApiAuth(async function GET(request: NextRequest) {
  // Объявляем id вне блоков try/catch, чтобы она была доступна в обоих блоках
  let id: string = 'unknown'; // Инициализируем значением по умолчанию
  
  try {
    id = request.nextUrl.pathname.split('/')[3]; // Extract ID from URL path
    if (!id) {
      return corsResponse(
        { error: 'Missing act ID' },
        { status: 400 }
      );
    }
    
    // Get act by ID
    const act = await escrowManager.getAct(id);
    
    return corsResponse(act);
  } catch (error: any) {
    console.error(`Error getting act ${id || 'unknown'}:`, error);
    
    // Handle not found error
    if (error.message?.includes('not found')) {
      return corsResponse(
        { error: 'Act not found' },
        { status: 404 }
      );
    }
    
    return corsResponse(
      { error: error.message || 'Failed to get act' },
      { status: 500 }
    );
  }
}));
