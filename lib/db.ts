import 'server-only';

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

// Function to get database connection string
function getDatabaseUrl() {
  // If POSTGRES_URL is directly provided, use it
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }
  
  // Otherwise, construct from individual components
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const database = process.env.POSTGRES_DB || 'escrow';
  const sslMode = process.env.POSTGRES_SSL === 'true' ? '?sslmode=require' : '';
  
  return `postgres://${user}:${password}@${host}:${port}/${database}${sslMode}`;
}

// Get the connection string
const connectionString = getDatabaseUrl();

// Create Postgres connection pool
const pool = new Pool({ connectionString });

// Create the Drizzle client
export const dbClient = drizzle(pool);

import {
  pgTable,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
  serial
} from 'drizzle-orm/pg-core';
import { count, eq, ilike } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

// Import schemas
import * as schema from './schema';

// Types for database client
export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

// Initialize database connection with all schemas
// Use lazy initialization to prevent errors during build time
let _db: DbClient | null = null;

/**
 * Get database client instance
 * Always uses a real connection to the database
 */
export function getDb(): DbClient {
  // For server-side only
  if (typeof window === 'undefined') {
    // If we already have a DB instance, use it
    if (_db) {
      return _db;
    }

    // Check if POSTGRES_URL is set
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set. Database connection cannot be established.');
    }
    
    // Create a real connection to the database
    console.log('Connecting to Postgres database...');
    _db = drizzle(new Pool({ connectionString: process.env.POSTGRES_URL! }), { schema });
    return _db;
  }
  
  // Client-side access is not allowed
  throw new Error('Database client cannot be used on the client side');
}

// Export db client for use across the application
// This always uses a real connection when on server side
export const db: DbClient = typeof window === 'undefined' 
  ? getDb() 
  : null as unknown as DbClient;

// Note: The following code for products table is not part of the actual schema
// It was included in the template but not used in the actual application
// Commented out to prevent errors when accessing non-existent table

/*
export const statusEnum = pgEnum('status', ['active', 'inactive', 'archived']);

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  name: text('name').notNull(),
  status: statusEnum('status').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull(),
  availableAt: timestamp('available_at').notNull()
});

export type SelectProduct = typeof products.$inferSelect;
export const insertProductSchema = createInsertSchema(products);

export async function getProducts(
  search: string,
  offset: number
): Promise<{
  products: SelectProduct[];
  newOffset: number | null;
  totalProducts: number;
}> {
  // Always search the full table, not per page
  if (search) {
    return {
      products: await db
        .select()
        .from(products)
        .where(ilike(products.name, `%${search}%`))
        .limit(1000),
      newOffset: null,
      totalProducts: 0
    };
  }

  if (offset === null) {
    return { products: [], newOffset: null, totalProducts: 0 };
  }

  let totalProducts = await db.select({ count: count() }).from(products);
  let moreProducts = await db.select().from(products).limit(5).offset(offset);
  let newOffset = moreProducts.length >= 5 ? offset + 5 : null;

  return {
    products: moreProducts,
    newOffset,
    totalProducts: totalProducts[0].count
  };
}

export async function deleteProductById(id: number) {
  await db.delete(products).where(eq(products.id, id));
}
*/
