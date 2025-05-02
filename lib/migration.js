/**
 * Database Migration Script
 * 
 * This script applies all migrations from the 'drizzle' folder to the database.
 * It requires a valid POSTGRES_URL environment variable to connect to the database.
 */

const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { migrate } = require('drizzle-orm/neon-http/migrator');

// Import .env file for environment variables
require('dotenv/config');

// Check if database URL is provided
if (!process.env.POSTGRES_URL) {
  console.error('Error: POSTGRES_URL is not defined in environment variables');
  process.exit(1);
}

// Initialize the database connection with Neon serverless driver
const sql = neon(process.env.POSTGRES_URL);
const db = drizzle(sql);

// Apply all migrations from the drizzle folder
console.log('Starting database migration...');

migrate(db, { migrationsFolder: 'drizzle' })
  .then(() => {
    console.log('Migrations completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
