import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { orders } from './orders';

// Interest Only table
export const interestOnly = pgTable('interest_only', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.orderId] }),
  };
});
