import { pgTable, text, boolean, timestamp, pgEnum, numeric, primaryKey } from 'drizzle-orm/pg-core';

// User type enum
export const userTypeEnum = pgEnum('user_type', ['CUSTOMER', 'CONTRACTOR', 'PLATFORM']);

// Order status enum
export const orderStatusEnum = pgEnum('order_status', ['CREATED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED']);

// Milestone status enum
export const milestoneStatusEnum = pgEnum('milestone_status', ['PENDING', 'ACTIVE', 'COMPLETED', 'PAID']);

// Document type enum
export const documentTypeEnum = pgEnum('document_type', [
  'DEFINITION_OF_READY', 
  'ROADMAP', 
  'DEFINITION_OF_DONE', 
  'SPECIFICATION', 
  'DELIVERABLE'
]);

// Act status enum
export const actStatusEnum = pgEnum('act_status', ['CREATED', 'CONTRACTOR_SIGNED', 'COMPLETED', 'REJECTED']);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  type: userTypeEnum('type').notNull(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Orders table
export const orders = pgTable('orders', {
  id: text('id').primaryKey().notNull(),
  isGroupOrder: boolean('is_group_order').notNull().default(false),
  representativeId: text('representative_id'),
  contractorId: text('contractor_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: orderStatusEnum('status').notNull().default('CREATED'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  fundedAmount: numeric('funded_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Milestones table
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  deadline: timestamp('deadline').notNull(),
  status: milestoneStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Documents table
export const documents = pgTable('documents', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: documentTypeEnum('type').notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  approvedBy: text('approved_by').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Deliverable extensions table
export const deliverableExtensions = pgTable('deliverable_extensions', {
  documentId: text('document_id').primaryKey().notNull().references(() => documents.id, { onDelete: 'cascade' }),
  phaseId: text('phase_id'),
  attachments: text('attachments').array()
});

// Acts table
export const acts = pgTable('acts', {
  id: text('id').primaryKey().notNull(),
  milestoneId: text('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  deliverableIds: text('deliverable_ids').array().notNull(),
  status: actStatusEnum('status').notNull().default('CREATED'),
  signedBy: text('signed_by').array(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Customer_orders junction table
export const customerOrders = pgTable('customer_orders', {
  customerId: text('customer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.customerId, table.orderId] }),
  };
});

// Representative votes table
export const representativeVotes = pgTable('representative_votes', {
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  voterId: text('voter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  candidateId: text('candidate_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.orderId, table.voterId] }),
  };
});

// Interest Only table (new)
export const interestOnly = pgTable('interest_only', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.orderId] }),
  };
});
