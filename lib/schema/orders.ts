import { pgTable, text, numeric, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { orderStatusEnum } from './enums';
import { v4 as uuidv4 } from 'uuid';

// Orders table
export const orders = pgTable('orders', {
  id: text('id').primaryKey().notNull().$defaultFn(() => uuidv4()),
  // customerIds field removed - we use customer_orders junction table instead
  isGroupOrder: boolean('is_group_order').notNull().default(false),
  representativeId: text('representative_id'), // Optional: for group orders
  contractorId: text('contractor_id'), // Optional: assigned later
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: orderStatusEnum('status').notNull().default('CREATED'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  fundedAmount: numeric('funded_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
  // votes field removed as it doesn't exist in the DB schema
});

// Define Zod schemas for validation
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);

// Define types for TypeScript
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
