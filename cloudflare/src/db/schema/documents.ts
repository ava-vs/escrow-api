import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { orders } from './orders';

// Documents table (SQLite version)
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type', { 
    enum: ['CONTRACT', 'ROADMAP', 'SPECIFICATION', 'DELIVERY', 'OTHER'] 
  }).notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(), // User ID
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  approvedBy: text('approved_by'), // JSON array of user IDs who approved
  // Content will be stored as JSON with type-specific structure
  content: text('content').notNull(), // JSON string
});

// Acts table - for document approval workflow
export const acts = sqliteTable('acts', {
  id: text('id').primaryKey().notNull(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  type: text('type', { 
    enum: ['APPROVAL', 'SIGNATURE', 'COMPLETION', 'REJECTION'] 
  }).notNull(),
  description: text('description').notNull(),
  createdBy: text('created_by').notNull(), // User ID
  status: text('status', { 
    enum: ['PENDING', 'SIGNED', 'COMPLETED', 'REJECTED'] 
  }).notNull().default('PENDING'),
  signatories: text('signatories'), // JSON array of required signatories
  signatures: text('signatures'), // JSON array of actual signatures
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Define Zod schemas for validation
export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);
export const insertActSchema = createInsertSchema(acts);
export const selectActSchema = createSelectSchema(acts);

// Define types for TypeScript
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Act = typeof acts.$inferSelect;
export type NewAct = typeof acts.$inferInsert;