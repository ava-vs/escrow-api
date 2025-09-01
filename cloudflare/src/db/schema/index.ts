// Export all schema tables and types
export * from './users';
export * from './orders';
export * from './documents';
export * from './chat';
export * from './notifications';
export * from './marketplace';

// Re-export from users for backward compatibility
export { users } from './users';
export type { User, NewUser } from './users';

// Export orders and related tables
export { orders, milestones, customerOrders } from './orders';
export type { Order, NewOrder, Milestone, NewMilestone, CustomerOrder, NewCustomerOrder } from './orders';

// Export documents and acts
export { documents, acts } from './documents';
export type { Document, NewDocument, Act, NewAct } from './documents';

// Export chat tables
export { orderChats, chatParticipants, chatMessages, messageReadStatus } from './chat';
export type { OrderChat, NewOrderChat, ChatMessage, NewChatMessage, ChatParticipant, MessageReadStatus } from './chat';

// Export notification tables
export { notifications, notificationPreferences, userAnalytics, platformAnalytics } from './notifications';
export type { Notification, NewNotification, NotificationPreferences, NewNotificationPreferences, UserAnalytics, NewUserAnalytics, PlatformAnalytics, NewPlatformAnalytics } from './notifications';

// Export marketplace tables
export { 
  marketplaceProducts, 
  productSales, 
  productLicenses,
  salesEscrowAccounts,
  revenueParticipants,
  revenueDistributions,
  distributionDetails
} from './marketplace';