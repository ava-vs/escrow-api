// /**
//  * Auth module for JWT authentication
//  * Handles token generation, verification and refresh
//  * This implementation is part of the unified JWT authentication system
//  * shared between Ailock and Escrow API
//  */

// import jwt from 'jsonwebtoken';
// import crypto from 'crypto';
// import { db } from '../db/db.js';
// import { eq, and, gt } from 'drizzle-orm';
// import { authTokens } from '../db/schema.js';
// import { v4 as uuidv4 } from 'uuid';

// // JWT secret from environment variables
// const JWT_SECRET = process.env.JWT_SECRET;
// // Access token expiration time (15 minutes)
// const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
// // Refresh token expiration time (30 days)
// const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// /**
//  * Generate JWT access and refresh tokens for a user
//  * @param {string} userId - User ID
//  * @returns {Promise<{accessToken: string, refreshToken: string}>} Generated tokens
//  */
// export async function generateTokens(userId) {
//   // Create access token
//   const accessToken = jwt.sign(
//     { sub: userId, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY },
//     JWT_SECRET
//   );
  
//   // Create refresh token
//   const refreshToken = crypto.randomBytes(64).toString('hex');
//   const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
//   // Save refresh token in database
//   await db.insert(authTokens).values({
//     id: uuidv4(),
//     user_id: userId,
//     service: 'ESCROW',
//     refresh_hash: refreshHash,
//     expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
//     created_at: new Date()
//   });
  
//   return {
//     accessToken,
//     refreshToken
//   };
// }

// /**
//  * Verify JWT access token
//  * @param {string} token - JWT access token
//  * @returns {object|null} Decoded token payload or null if invalid
//  */
// export function verifyAccessToken(token) {
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     return decoded;
//   } catch (error) {
//     console.error('Token verification failed:', error.message);
//     return null;
//   }
// }

// /**
//  * Refresh tokens using a refresh token
//  * @param {string} refreshToken - Refresh token
//  * @returns {Promise<{accessToken: string, refreshToken: string}|null>} New tokens or null if invalid
//  */
// export async function refreshTokens(refreshToken) {
//   try {
//     // Calculate refresh token hash
//     const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
//     // Find token in database
//     const tokenRecord = await db.select().from(authTokens).where(
//       and(
//         eq(authTokens.refresh_hash, refreshHash),
//         gt(authTokens.expires_at, new Date())
//       )
//     ).limit(1);
    
//     if (!tokenRecord || tokenRecord.length === 0) {
//       console.warn('Refresh token not found or expired');
//       return null;
//     }
    
//     const token = tokenRecord[0];
    
//     // Delete the used refresh token (token rotation)
//     await db.delete(authTokens).where(eq(authTokens.id, token.id));
    
//     // Generate new tokens
//     return generateTokens(token.user_id);
//   } catch (error) {
//     console.error('Error refreshing tokens:', error);
//     return null;
//   }
// }

// /**
//  * Invalidate refresh token (logout)
//  * @param {string} refreshToken - Refresh token to invalidate
//  * @returns {Promise<boolean>} Success status
//  */
// export async function invalidateToken(refreshToken) {
//   try {
//     // Calculate refresh token hash
//     const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
//     // Delete token from database
//     const result = await db.delete(authTokens).where(eq(authTokens.refresh_hash, refreshHash));
    
//     return true;
//   } catch (error) {
//     console.error('Error invalidating token:', error);
//     return false;
//   }
// }

// /**
//  * Extract JWT token from authorization header
//  * @param {object} req - Express request object
//  * @returns {string|null} JWT token or null if not found
//  */
// export function extractTokenFromHeader(req) {
//   const authHeader = req.headers.authorization;
  
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return null;
//   }
  
//   return authHeader.split(' ')[1];
// }

// /**
//  * Auth middleware for Express
//  * @param {object} req - Express request object
//  * @param {object} res - Express response object
//  * @param {function} next - Express next function
//  */
// export function authMiddleware(req, res, next) {
//   const token = extractTokenFromHeader(req);
  
//   if (!token) {
//     return res.status(401).json({ error: 'Unauthorized: Missing token' });
//   }
  
//   const decoded = verifyAccessToken(token);
  
//   if (!decoded) {
//     return res.status(401).json({ error: 'Unauthorized: Invalid token' });
//   }
  
//   // Add user to request object
//   req.user = { id: decoded.sub };
  
//   next();
// }

// /**
//  * Export compatibility objects and functions for Next Auth
//  * These are required for the Next.js authentication system
//  */

// // Handlers for NextAuth API routes
// export const handlers = {
//   // Implementing handlers for NextAuth compatibility
//   signin: async (req, res) => {
//     // Implementation depends on the NextAuth configuration
//     return { status: "success" };
//   },
//   callback: async (req, res) => {
//     // Implementation depends on the NextAuth configuration
//     return { status: "success" };
//   },
//   signout: async (req, res) => {
//     // Implementation depends on the NextAuth configuration
//     return { status: "success" };
//   }
// };

// // Sign in function for client-side authentication
// export const signIn = async (provider, options) => {
//   // Implementation depends on the client-side auth flow
//   console.log('Sign in with provider:', provider, options);
//   return { status: "success" };
// };
