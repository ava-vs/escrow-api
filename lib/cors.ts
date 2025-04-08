/**
 * CORS utilities for API routes
 * Helper functions to add CORS headers to API responses
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Default CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleCorsPreflightRequest() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeadersToResponse(response: NextResponse): NextResponse {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create a new response with CORS headers
 */
export function corsResponse(body: any, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  return addCorsHeadersToResponse(response);
}

/**
 * Wrap an API handler with CORS support
 */
export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(request: NextRequest) {
    // Handle OPTIONS request for preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest();
    }
    
    // Call the original handler
    const response = await handler(request);
    
    // Add CORS headers to the response
    return addCorsHeadersToResponse(response);
  };
}
