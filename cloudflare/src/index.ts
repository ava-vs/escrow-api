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
import { adminRoutes } from './routes/admin';

// Durable Objects disabled for free plan deployment
// export { ChatDurableObject } from './durable-objects/chat-do';
// export { EscrowManagerDurableObject } from './durable-objects/escrow-manager-do';

// Environment interface for free plan
export interface Env {
  // D1 Database (Free: 5GB storage, 5M reads/day, 100K writes/day)
  DB: D1Database;
  
  // KV Namespace for authentication (Free: 100K reads/day, 1K writes/day)
  KV_AUTH?: KVNamespace;
  
  // Environment variables
  ENVIRONMENT: string;
  JWT_SECRET: string;
  API_KEY: string;
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
app.route('/api/admin', adminRoutes);

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