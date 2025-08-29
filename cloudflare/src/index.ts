/**
 * Main entry point for Escrow API Cloudflare Workers
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// Import route handlers
import { usersRoutes } from './routes/users';
import { ordersRoutes } from './routes/orders';
import { chatRoutes } from './routes/chat';
import { marketplaceRoutes } from './routes/marketplace';
import { authRoutes } from './routes/auth';
import { documentsRoutes } from './routes/documents';

// Import Durable Objects
export { ChatDurableObject } from './durable-objects/chat-do';
export { EscrowManagerDurableObject } from './durable-objects/escrow-manager-do';

// Environment interface
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // R2 Storage
  FILES: R2Bucket;
  
  // Durable Objects
  CHAT_DO: DurableObjectNamespace;
  ESCROW_MANAGER_DO: DurableObjectNamespace;
  

  
  // Environment variables
  ENVIRONMENT: string;
  JWT_SECRET: string;
  API_KEY: string;
  
  // Cloudflare API credentials
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://escrow-api.com'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'Escrow API - Cloudflare Workers',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/documents', documentsRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/marketplace', marketplaceRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    error: 'Internal Server Error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : 'Something went wrong'
  }, 500);
});

export default app;