/**
 * API authorization utilities
 * Verifies API keys for protected endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { corsResponse } from './cors';

// Environment variable for API key - should be set in deployment environment
// For development, you can set this in .env.local
const VERCEL_API_KEY = process.env.VERCEL_API_KEY;

/**
 * Verify API key from request headers
 * @param apiKey API key from request header
 * @returns boolean indicating if the API key is valid
 */
export function verifyApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;
  
  // In production, we should verify against VERCEL_API_KEY
  if (VERCEL_API_KEY) {
    return apiKey === VERCEL_API_KEY;
  }
  
  // If no API key is set in environment, authentication is disabled
  // This should never happen in production
  console.warn('API key validation is disabled because VERCEL_API_KEY is not set');
  return false;
}

/**
 * Middleware wrapper to protect API routes with API key authentication
 */
export function withApiAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(request: NextRequest) {
    // Get API key from Authorization header or X-API-Key header
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader ? 
      (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader) : 
      request.headers.get('X-API-Key');
    
    // Verify the API key
    if (!verifyApiKey(apiKey)) {
      return corsResponse(
        { error: 'Unauthorized', message: 'Invalid or missing API key' }, 
        { status: 401 }
      );
    }
    
    // Call the original handler
    return handler(request);
  };
}
