import { pgTable, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { milestoneStatusEnum } from './enums';
import { v4 as uuidv4 } from 'uuid';
import { orders } from './orders';

// Milestones table
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey().notNull().$defaultFn(() => uuidv4()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  deadline: timestamp('deadline').notNull(),
  status: milestoneStatusEnum('status').notNull().default('PENDING'),
  // Поле paid удалено, так как отсутствует в базе данных
  // Optional link to a phase in a Roadmap document
  // roadmapPhaseId: text('roadmap_phase_id'), // Поле отсутствует в базе данных
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define Zod schemas for validation
export const insertMilestoneSchema = createInsertSchema(milestones);
export const selectMilestoneSchema = createSelectSchema(milestones);

// Define types for TypeScript
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
