/**
 * API authorization utilities
 * Verifies API keys for protected endpoints and manages user authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { corsResponse } from './cors';
import { AuthenticatedRequest } from './escrow-lib/interfaces';

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
 * Mock function to get user data from token
 * In a real application, this would verify the JWT token and extract user data
 * @param token Authentication token
 * @returns User data if token is valid, null otherwise
 */
function getUserFromToken(token: string): { id: string; name?: string; email?: string; type?: string } | null {
  // Mock implementation - in a real app, we would decode and verify the JWT
  // This is just for demonstration purposes
  if (!token) return null;
  
  // Simple mock user for demo
  return {
    id: '12345',
    name: 'Demo User',
    email: 'demo@example.com',
    type: 'customer'
  };
}

/**
 * Middleware wrapper to protect API routes with API key authentication
 * and add user information to the request object
 */
export function withApiAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async function(request: NextRequest) {
    // Cast request to AuthenticatedRequest to attach auth property
    const authenticatedRequest = request as AuthenticatedRequest;
    
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
    
    // Get authentication token from Bearer header
    // In this demo, we're using the same header for API key and user auth
    // In a real app, you might use different headers or JWT in cookies
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = getUserFromToken(token);
      
      // Add user info to request object if token is valid
      if (user) {
        authenticatedRequest.auth = user;
      }
    }
    
    // Call the original handler with the authenticated request
    return handler(authenticatedRequest);
  };
}
