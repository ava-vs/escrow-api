/**
 * API authorization utilities
 * Verifies API keys for protected endpoints and manages user authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { corsResponse } from './cors';
import { AuthenticatedRequest } from './escrow-lib/interfaces';
import jwt from 'jsonwebtoken';

// Environment variable for API key - should be set in deployment environment
// For development, you can set this in .env.local
const VERCEL_API_KEY = process.env.VERCEL_API_KEY;
// Environment variable for JWT secret - MUST match the one used in auth-service
const JWT_SECRET = process.env.JWT_SECRET;

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
 * Verifies the JWT token passed in the Authorization header and extracts user data.
 * @param token Authentication token (without 'Bearer ' prefix)
 * @returns User data if token is valid, null otherwise
 */
function getUserFromToken(token: string): { id: string } | null {
  if (!token) return null;

  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set. Cannot verify token.');
    // In a real production scenario, this might throw an error or return null
    // depending on security requirements.
    return null; 
  }

  try {
    // Verify the token using the secret
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    // Check if 'sub' (subject, typically user ID) exists in the decoded payload
    if (decoded && typeof decoded.sub === 'string') {
      // Return the user ID
      return { id: decoded.sub };
    } else {
      console.warn('Token is valid but missing `sub` claim or `sub` is not a string.');
      return null;
    }
  } catch (error: any) {
    // Handle errors like invalid signature, expired token, etc.
    console.warn(`JWT verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Middleware wrapper to protect API routes with API key authentication
 * and add user information to the request object
 */
export function withApiAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async function(request: NextRequest) {
    // Log entry into the middleware wrapper
    console.log(`>>> Entering withApiAuth middleware for: ${request.method} ${request.nextUrl.pathname}`);

    // Cast request to AuthenticatedRequest to attach auth property
    const authenticatedRequest = request as AuthenticatedRequest;
    
    let isAuthenticated = false;

    // Get authentication token from Bearer header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = getUserFromToken(token);
      
      // Add user info to request object if token is valid
      if (user) {
        authenticatedRequest.auth = user;
        isAuthenticated = true; // Authenticated via JWT
      } else {
        // If Bearer token is present but invalid, return 401 immediately
        return corsResponse(
          { error: 'Unauthorized', message: 'Invalid or expired token' },
          { status: 401 }
        );
      }
    } else {
      // --- No Bearer token, attempt API Key Authentication --- 
      // Get API key from Authorization header (if not Bearer) or X-API-Key header
      const apiKey = authHeader ? authHeader : request.headers.get('X-API-Key');
      
      // Verify the API key
      if (verifyApiKey(apiKey)) {
        isAuthenticated = true; // Authenticated via API Key
        // Note: API key auth doesn't currently attach user info in this example
      }
    }

    // If neither Bearer token nor API key authentication succeeded
    if (!isAuthenticated) {
      return corsResponse(
        { error: 'Unauthorized', message: 'Missing or invalid credentials (Bearer token or API key)' }, 
        { status: 401 }
      );
    }

    // Call the original handler with the authenticated request
    return handler(authenticatedRequest);
  };
}
