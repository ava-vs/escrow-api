import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Orders table (SQLite version)
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().notNull(),
  isGroupOrder: integer('is_group_order', { mode: 'boolean' }).notNull().default(false),
  representativeId: text('representative_id'), // Optional: for group orders
  contractorId: text('contractor_id'), // Optional: assigned later
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', { 
    enum: ['CREATED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] 
  }).notNull().default('CREATED'),
  totalAmount: real('total_amount').notNull().default(0),
  fundedAmount: real('funded_amount').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Customer-Order junction table
export const customerOrders = sqliteTable('customer_orders', {
  id: text('id').primaryKey().notNull(),
  customerId: text('customer_id').notNull(), // References users table (external)
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  contributedAmount: real('contributed_amount').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Milestones table
export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  deadline: integer('deadline', { mode: 'timestamp' }).notNull(),
  status: text('status', { 
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] 
  }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Define Zod schemas for validation
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export const insertMilestoneSchema = createInsertSchema(milestones);
export const selectMilestoneSchema = createSelectSchema(milestones);

// Define types for TypeScript
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type CustomerOrder = typeof customerOrders.$inferSelect;
export type NewCustomerOrder = typeof customerOrders.$inferInsert;