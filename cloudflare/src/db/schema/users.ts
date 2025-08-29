import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Users table for D1 (SQLite)
export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  type: text('type', { enum: ['CUSTOMER', 'CONTRACTOR', 'PLATFORM'] }).notNull(),
  balance: real('balance').notNull().default(0),
  bio: text('bio'),
  preferences: text('preferences'), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;