/**
 * Database Initialization Script
 * 
 * This script initializes the database schema by executing SQL commands directly.
 * It requires a valid POSTGRES_URL environment variable.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Import .env file for environment variables
require('dotenv/config');

// Check if database URL is provided
if (!process.env.POSTGRES_URL) {
  console.error('Error: POSTGRES_URL is not defined in environment variables');
  process.exit(1);
}

// Initialize the database connection with pg Client
const client = new Client({ connectionString: process.env.POSTGRES_URL });

// Read the SQL migration file
const migrationPath = path.join(__dirname, '..', 'drizzle', '0000_initial_migration.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Split SQL commands by semicolon and remove empty statements
const sqlCommands = migrationSql
  .split(';')
  .map(cmd => cmd.trim())
  .filter(cmd => cmd.length > 0);

// Function to execute SQL commands sequentially
async function executeCommands() {
  console.log(`Starting database initialization with ${sqlCommands.length} commands...`);
  
  await client.connect();
  
  for (let i = 0; i < sqlCommands.length; i++) {
    const command = sqlCommands[i];
    try {
      console.log(`Executing command ${i + 1}/${sqlCommands.length}...`);
      await client.query(command);
      console.log('Command executed successfully.');
    } catch (error) {
      // If it's already exists error, we can continue
      if (error.code === '42P07' || error.code === '42710') {
        console.log(`Warning: Object already exists, continuing...`);
      } else {
        console.error(`Error executing command ${i + 1}:`, error);
        console.error('Failed command:', command);
        process.exit(1);
      }
    }
  }
  
  console.log('Database initialization completed successfully');
  await client.end();
  process.exit(0);
}

// Execute the commands
executeCommands().catch(error => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});
