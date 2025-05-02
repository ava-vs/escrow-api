import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { documentTypeEnum } from './enums';
import { v4 as uuidv4 } from 'uuid';
import { orders } from './orders';

// Base documents table
export const documents = pgTable('documents', {
  id: text('id').primaryKey().notNull().$defaultFn(() => uuidv4()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: documentTypeEnum('type').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(), // User ID
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedBy: text('approved_by').array(), // List of user IDs who approved
  // Content will be stored as JSON with type-specific structure
  content: jsonb('content').notNull(),
});

// Define Zod schemas for validation
export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);

// Define types for TypeScript
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
