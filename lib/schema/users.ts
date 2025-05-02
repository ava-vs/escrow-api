import { text, pgTable, numeric, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { userTypeEnum } from './enums';
import { v4 as uuidv4 } from 'uuid';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull().$defaultFn(() => uuidv4()),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  type: userTypeEnum('type').notNull(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// Define types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
