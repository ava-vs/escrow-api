/**
 * Database Migration Script
 * 
 * This script applies all migrations from the 'drizzle' folder to the database.
 * It requires a valid POSTGRES_URL environment variable to connect to the database.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Import .env file for environment variables
import 'dotenv/config';

// Check if database URL is provided
if (!process.env.POSTGRES_URL) {
  console.error('Error: POSTGRES_URL is not defined in environment variables');
  process.exit(1);
}

// Initialize the database connection with pg Pool
const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);

// Apply all migrations from the drizzle folder
console.log('Starting database migration...');

migrate(db, { migrationsFolder: 'drizzle' })
  .then(() => {
    console.log('Migrations completed successfully');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    pool.end();
    process.exit(1);
  });
