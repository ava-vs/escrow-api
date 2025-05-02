import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { actStatusEnum } from './enums';
import { v4 as uuidv4 } from 'uuid';
import { documents } from './documents';
import { milestones } from './milestones';

// Signature information type
export type ActSignature = {
  userId: string;
  signedAt: Date;
};

// Acts table
export const acts = pgTable('acts', {
  id: text('id').primaryKey().notNull().$defaultFn(() => uuidv4()),
  // Add explicit foreign key to documents table for proper relationship
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  milestoneId: text('milestone_id').notNull(), // Foreign key to milestones id 
  deliverableIds: text('deliverable_ids').array().notNull(), // IDs of deliverables being accepted
  status: actStatusEnum('status').notNull().default('CREATED'),
  // Using text[] for signed_by to match the SQL schema
  signedBy: text('signed_by').array(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define Zod schemas for validation
export const insertActSchema = createInsertSchema(acts);
export const selectActSchema = createSelectSchema(acts);

// Define types for TypeScript
export type Act = typeof acts.$inferSelect;
export type NewAct = typeof acts.$inferInsert;
