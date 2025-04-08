import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Customer Orders junction table for many-to-many relationship
export const customerOrders = pgTable('customer_orders', {
  customerId: text('customer_id').notNull(),
  orderId: text('order_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.customerId, table.orderId] })
}));

// Define Zod schemas for validation
export const insertCustomerOrderSchema = createInsertSchema(customerOrders);
export const selectCustomerOrderSchema = createSelectSchema(customerOrders);

// Define types for TypeScript
export type CustomerOrder = typeof customerOrders.$inferSelect;
export type NewCustomerOrder = typeof customerOrders.$inferInsert;
