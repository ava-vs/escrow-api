import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const representativeVotes = pgTable('representative_votes', {
  orderId: text('order_id').notNull(),
  voterId: text('voter_id').notNull(),
  candidateId: text('candidate_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.orderId, table.voterId] })
}));

export type RepresentativeVote = typeof representativeVotes.$inferSelect;
export type NewRepresentativeVote = typeof representativeVotes.$inferInsert;