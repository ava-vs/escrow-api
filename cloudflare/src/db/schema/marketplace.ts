import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey().notNull(),
  orderId: text('order_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('1.0.0'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileSize: integer('file_size'),
  checksum: text('checksum'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Product deliveries table
export const productDeliveries = sqliteTable('product_deliveries', {
  id: text('id').primaryKey().notNull(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').notNull(),
  messageId: text('message_id').notNull(),
  deliveredBy: text('delivered_by').notNull(),
  deliveryNote: text('delivery_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Delivery confirmations table
export const deliveryConfirmations = sqliteTable('delivery_confirmations', {
  id: text('id').primaryKey().notNull(),
  deliveryId: text('delivery_id').notNull().references(() => productDeliveries.id, { onDelete: 'cascade' }),
  confirmedBy: text('confirmed_by').notNull(),
  confirmationNote: text('confirmation_note'),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Marketplace products table
export const marketplaceProducts = sqliteTable('marketplace_products', {
  id: text('id').primaryKey().notNull(),
  originalProductId: text('original_product_id').notNull().references(() => products.id),
  sellerId: text('seller_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  commissionRate: real('commission_rate').notNull().default(0.1),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Product sales table
export const productSales = sqliteTable('product_sales', {
  id: text('id').primaryKey().notNull(),
  marketplaceProductId: text('marketplace_product_id').notNull().references(() => marketplaceProducts.id),
  buyerId: text('buyer_id').notNull(),
  salePrice: real('sale_price').notNull(),
  platformCommission: real('platform_commission').notNull(),
  sellerAmount: real('seller_amount').notNull(),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'REFUNDED'] }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Product licenses table
export const productLicenses = sqliteTable('product_licenses', {
  id: text('id').primaryKey().notNull(),
  saleId: text('sale_id').notNull().references(() => productSales.id, { onDelete: 'cascade' }),
  licenseKey: text('license_key').unique().notNull(),
  downloadUrl: text('download_url').notNull(),
  downloadsCount: integer('downloads_count').notNull().default(0),
  maxDownloads: integer('max_downloads').notNull().default(5),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Sales escrow accounts table
export const salesEscrowAccounts = sqliteTable('sales_escrow_accounts', {
  id: text('id').primaryKey().notNull(),
  marketplaceProductId: text('marketplace_product_id').notNull().references(() => marketplaceProducts.id),
  totalSalesAmount: real('total_sales_amount').notNull().default(0),
  platformCommissionAmount: real('platform_commission_amount').notNull().default(0),
  availableForDistribution: real('available_for_distribution').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Revenue participants table
export const revenueParticipants = sqliteTable('revenue_participants', {
  id: text('id').primaryKey().notNull(),
  salesEscrowAccountId: text('sales_escrow_account_id').notNull().references(() => salesEscrowAccounts.id),
  participantId: text('participant_id').notNull(),
  participationType: text('participation_type', { enum: ['CUSTOMER', 'CONTRACTOR', 'PLATFORM'] }).notNull(),
  sharePercentage: real('share_percentage').notNull(),
  totalReceived: real('total_received').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Revenue distributions table
export const revenueDistributions = sqliteTable('revenue_distributions', {
  id: text('id').primaryKey().notNull(),
  salesEscrowAccountId: text('sales_escrow_account_id').notNull().references(() => salesEscrowAccounts.id),
  distributionAmount: real('distribution_amount').notNull(),
  distributionDate: integer('distribution_date', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  triggerType: text('trigger_type', { enum: ['MANUAL', 'THRESHOLD', 'SCHEDULED'] }).notNull(),
  notes: text('notes'),
});

// Distribution details table
export const distributionDetails = sqliteTable('distribution_details', {
  id: text('id').primaryKey().notNull(),
  distributionId: text('distribution_id').notNull().references(() => revenueDistributions.id),
  participantId: text('participant_id').notNull(),
  amount: real('amount').notNull(),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED'] }).notNull().default('PENDING'),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
});

// Distribution settings table
export const distributionSettings = sqliteTable('distribution_settings', {
  id: text('id').primaryKey().notNull(),
  salesEscrowAccountId: text('sales_escrow_account_id').notNull().references(() => salesEscrowAccounts.id),
  autoDistributionEnabled: integer('auto_distribution_enabled', { mode: 'boolean' }).notNull().default(false),
  distributionThreshold: real('distribution_threshold'),
  distributionFrequency: text('distribution_frequency', { enum: ['DAILY', 'WEEKLY', 'MONTHLY'] }),
  nextDistributionDate: integer('next_distribution_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Zod schemas
export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export const insertMarketplaceProductSchema = createInsertSchema(marketplaceProducts);
export const selectMarketplaceProductSchema = createSelectSchema(marketplaceProducts);

// TypeScript types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type MarketplaceProduct = typeof marketplaceProducts.$inferSelect;
export type NewMarketplaceProduct = typeof marketplaceProducts.$inferInsert;
export type ProductSale = typeof productSales.$inferSelect;
export type ProductLicense = typeof productLicenses.$inferSelect;
export type SalesEscrowAccount = typeof salesEscrowAccounts.$inferSelect;
export type RevenueParticipant = typeof revenueParticipants.$inferSelect;
export type RevenueDistribution = typeof revenueDistributions.$inferSelect;