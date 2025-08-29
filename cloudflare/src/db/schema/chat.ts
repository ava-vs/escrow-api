import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Order chats table
export const orderChats = sqliteTable('order_chats', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Chat participants table
export const chatParticipants = sqliteTable('chat_participants', {
  chatId: text('chat_id').notNull().references(() => orderChats.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['CUSTOMER', 'CONTRACTOR', 'PLATFORM'] }).notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Chat messages table
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chat_id').notNull().references(() => orderChats.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull(),
  messageType: text('message_type', { 
    enum: ['TEXT', 'FILE', 'PRODUCT_DELIVERY', 'SYSTEM'] 
  }).notNull().default('TEXT'),
  content: text('content').notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: integer('file_size'),
  replyToId: text('reply_to_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Message read status table
export const messageReadStatus = sqliteTable('message_read_status', {
  messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Zod schemas
export const insertOrderChatSchema = createInsertSchema(orderChats);
export const selectOrderChatSchema = createSelectSchema(orderChats);
export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const selectChatMessageSchema = createSelectSchema(chatMessages);

// TypeScript types
export type OrderChat = typeof orderChats.$inferSelect;
export type NewOrderChat = typeof orderChats.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type MessageReadStatus = typeof messageReadStatus.$inferSelect;