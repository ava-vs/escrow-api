import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Notifications table
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull(),
  type: text('type', { 
    enum: ['ORDER_STATUS', 'PAYMENT', 'CHAT_MESSAGE', 'SYSTEM', 'MILESTONE', 'DOCUMENT'] 
  }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data'), // JSON string
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Notification preferences table
export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id').primaryKey().notNull(),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(true),
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).notNull().default(true),
  smsEnabled: integer('sms_enabled', { mode: 'boolean' }).notNull().default(false),
  orderUpdates: integer('order_updates', { mode: 'boolean' }).notNull().default(true),
  paymentUpdates: integer('payment_updates', { mode: 'boolean' }).notNull().default(true),
  chatMessages: integer('chat_messages', { mode: 'boolean' }).notNull().default(true),
  systemUpdates: integer('system_updates', { mode: 'boolean' }).notNull().default(true),
  preferences: text('preferences'), // JSON string for detailed preferences
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// User analytics table
export const userAnalytics = sqliteTable('user_analytics', {
  userId: text('user_id').primaryKey().notNull(),
  totalOrders: integer('total_orders').notNull().default(0),
  completedOrders: integer('completed_orders').notNull().default(0),
  cancelledOrders: integer('cancelled_orders').notNull().default(0),
  totalEarnings: real('total_earnings').notNull().default(0),
  totalSpent: real('total_spent').notNull().default(0),
  averageOrderValue: real('average_order_value').notNull().default(0),
  successRate: real('success_rate').notNull().default(0),
  averageCompletionDays: real('average_completion_days').notNull().default(0),
  lastActivity: integer('last_activity', { mode: 'timestamp' }),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Platform analytics table
export const platformAnalytics = sqliteTable('platform_analytics', {
  id: text('id').primaryKey().notNull(),
  date: text('date').notNull(), // YYYY-MM-DD format
  totalOrders: integer('total_orders').notNull().default(0),
  completedOrders: integer('completed_orders').notNull().default(0),
  totalVolume: real('total_volume').notNull().default(0),
  platformRevenue: real('platform_revenue').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  newRegistrations: integer('new_registrations').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Zod schemas
export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences);
export const selectNotificationPreferencesSchema = createSelectSchema(notificationPreferences);
export const insertUserAnalyticsSchema = createInsertSchema(userAnalytics);
export const selectUserAnalyticsSchema = createSelectSchema(userAnalytics);
export const insertPlatformAnalyticsSchema = createInsertSchema(platformAnalytics);
export const selectPlatformAnalyticsSchema = createSelectSchema(platformAnalytics);

// TypeScript types
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
export type UserAnalytics = typeof userAnalytics.$inferSelect;
export type NewUserAnalytics = typeof userAnalytics.$inferInsert;
export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;
export type NewPlatformAnalytics = typeof platformAnalytics.$inferInsert;

// Notification types enum
export const NotificationTypes = {
  ORDER_STATUS: 'ORDER_STATUS',
  PAYMENT: 'PAYMENT',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  SYSTEM: 'SYSTEM',
  MILESTONE: 'MILESTONE',
  DOCUMENT: 'DOCUMENT'
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];