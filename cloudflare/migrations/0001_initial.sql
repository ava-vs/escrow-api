-- Migration: Initial schema for Escrow API on Cloudflare D1
-- Created: 2024-12-18

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  balance REAL NOT NULL DEFAULT 0,
  bio TEXT,
  preferences TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Orders table
CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  is_group_order INTEGER NOT NULL DEFAULT 0, -- Boolean as INTEGER
  representative_id TEXT,
  contractor_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED')),
  total_amount REAL NOT NULL DEFAULT 0,
  funded_amount REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Customer-Orders junction table
CREATE TABLE customer_orders (
  customer_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, order_id)
);

-- Milestones table
CREATE TABLE milestones (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  deadline INTEGER NOT NULL, -- Timestamp
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'COMPLETED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Representative votes table
CREATE TABLE representative_votes (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Interest tracking table
CREATE TABLE interest_only (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

-- Order chats table
CREATE TABLE order_chats (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Chat participants table
CREATE TABLE chat_participants (
  chat_id TEXT NOT NULL REFERENCES order_chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- Chat messages table
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL REFERENCES order_chats(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'FILE', 'PRODUCT_DELIVERY', 'SYSTEM')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to_id TEXT REFERENCES chat_messages(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Message read status table
CREATE TABLE message_read_status (
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

-- Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  checksum TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Product deliveries table
CREATE TABLE product_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  delivered_by TEXT NOT NULL,
  delivery_note TEXT,
  created_at INTEGER NOT NULL
);

-- Delivery confirmations table
CREATE TABLE delivery_confirmations (
  id TEXT PRIMARY KEY NOT NULL,
  delivery_id TEXT NOT NULL REFERENCES product_deliveries(id) ON DELETE CASCADE,
  confirmed_by TEXT NOT NULL,
  confirmation_note TEXT,
  confirmed_at INTEGER NOT NULL
);

-- Marketplace products table
CREATE TABLE marketplace_products (
  id TEXT PRIMARY KEY NOT NULL,
  original_product_id TEXT NOT NULL REFERENCES products(id),
  seller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0.1,
  is_active INTEGER NOT NULL DEFAULT 1, -- Boolean as INTEGER
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Product sales table
CREATE TABLE product_sales (
  id TEXT PRIMARY KEY NOT NULL,
  marketplace_product_id TEXT NOT NULL REFERENCES marketplace_products(id),
  buyer_id TEXT NOT NULL,
  sale_price REAL NOT NULL,
  platform_commission REAL NOT NULL,
  seller_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REFUNDED')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Product licenses table
CREATE TABLE product_licenses (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES product_sales(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,
  download_url TEXT NOT NULL,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  expires_at INTEGER, -- Timestamp
  created_at INTEGER NOT NULL
);

-- Sales escrow accounts table
CREATE TABLE sales_escrow_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  marketplace_product_id TEXT NOT NULL REFERENCES marketplace_products(id),
  total_sales_amount REAL NOT NULL DEFAULT 0,
  platform_commission_amount REAL NOT NULL DEFAULT 0,
  available_for_distribution REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Revenue participants table
CREATE TABLE revenue_participants (
  id TEXT PRIMARY KEY NOT NULL,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  participant_id TEXT NOT NULL,
  participation_type TEXT NOT NULL CHECK (participation_type IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  share_percentage REAL NOT NULL,
  total_received REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Revenue distributions table
CREATE TABLE revenue_distributions (
  id TEXT PRIMARY KEY NOT NULL,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  distribution_amount REAL NOT NULL,
  distribution_date INTEGER NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('MANUAL', 'THRESHOLD', 'SCHEDULED')),
  notes TEXT
);

-- Distribution details table
CREATE TABLE distribution_details (
  id TEXT PRIMARY KEY NOT NULL,
  distribution_id TEXT NOT NULL REFERENCES revenue_distributions(id),
  participant_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  processed_at INTEGER
);

-- Distribution settings table
CREATE TABLE distribution_settings (
  id TEXT PRIMARY KEY NOT NULL,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  auto_distribution_enabled INTEGER NOT NULL DEFAULT 0, -- Boolean as INTEGER
  distribution_threshold REAL,
  distribution_frequency TEXT CHECK (distribution_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  next_distribution_date INTEGER, -- Timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Documents table
CREATE TABLE documents (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CONTRACT', 'ROADMAP', 'SPECIFICATION', 'DELIVERY', 'OTHER')),
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  approved_by TEXT, -- JSON array of user IDs who approved
  content TEXT NOT NULL -- JSON string
);

-- Acts table - for document approval workflow
CREATE TABLE acts (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('APPROVAL', 'SIGNATURE', 'COMPLETION', 'REJECTION')),
  description TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'COMPLETED', 'REJECTED')),
  signatories TEXT, -- JSON array of required signatories
  signatures TEXT, -- JSON array of actual signatures
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_contractor ON orders(contractor_id);
CREATE INDEX idx_customer_orders_customer ON customer_orders(customer_id);
CREATE INDEX idx_customer_orders_order ON customer_orders(order_id);
CREATE INDEX idx_milestones_order ON milestones(order_id);
CREATE INDEX idx_milestones_status ON milestones(status);
CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_products_order ON products(order_id);
CREATE INDEX idx_marketplace_products_seller ON marketplace_products(seller_id);
CREATE INDEX idx_marketplace_products_active ON marketplace_products(is_active);
CREATE INDEX idx_product_sales_buyer ON product_sales(buyer_id);
CREATE INDEX idx_product_sales_status ON product_sales(status);
CREATE INDEX idx_documents_order ON documents(order_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_acts_document ON acts(document_id);
CREATE INDEX idx_acts_status ON acts(status);
CREATE INDEX idx_acts_created_by ON acts(created_by);