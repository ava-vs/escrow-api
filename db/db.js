/**
 * Database connection module
 * Provides connection to the PostgreSQL database using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Get database connection string from environment variables
const connectionString = process.env.POSTGRES_URL || 
  process.env.DATABASE_URL || 
  'postgres://escrow_user:escrow_password@postgres:5432/escrow';

// Create connection pool
const pool = new Pool({
  connectionString,
  ssl: process.env.POSTGRES_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false
});

// Initialize Drizzle with the connection and schema
export const db = drizzle(pool, { schema });

// Export a function to get the raw pool for direct queries
export const getPool = () => pool;

// Export schema for convenience
export { schema };

/**
 * Execute raw SQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Close database connection
 * Use this when shutting down the application
 */
export const closeConnection = async () => {
  await pool.end();
};

export default db;
