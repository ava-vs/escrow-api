-- Migration: Add notifications and analytics tables
-- This adds comprehensive notification system and user analytics

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ORDER_STATUS', 'PAYMENT', 'CHAT_MESSAGE', 'SYSTEM', 'MILESTONE', 'DOCUMENT')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT, -- JSON with additional data
  read INTEGER DEFAULT 0, -- SQLite uses INTEGER for boolean
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_enabled INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 1,
  sms_enabled INTEGER DEFAULT 0,
  order_updates INTEGER DEFAULT 1,
  payment_updates INTEGER DEFAULT 1,
  chat_messages INTEGER DEFAULT 1,
  system_updates INTEGER DEFAULT 1,
  preferences TEXT, -- JSON with detailed preferences
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User analytics table for caching computed metrics
CREATE TABLE IF NOT EXISTS user_analytics (
  user_id TEXT PRIMARY KEY,
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  cancelled_orders INTEGER DEFAULT 0,
  total_earnings REAL DEFAULT 0,
  total_spent REAL DEFAULT 0,
  average_order_value REAL DEFAULT 0,
  success_rate REAL DEFAULT 0,
  average_completion_days REAL DEFAULT 0,
  last_activity INTEGER,
  computed_at INTEGER NOT NULL
);

-- Platform analytics for admin dashboard
CREATE TABLE IF NOT EXISTS platform_analytics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  total_volume REAL DEFAULT 0,
  platform_revenue REAL DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_registrations INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_computed ON user_analytics(computed_at);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON platform_analytics(date);

-- Insert default notification preferences for existing users
INSERT OR IGNORE INTO notification_preferences (user_id, created_at, updated_at)
SELECT id, created_at, updated_at FROM users;

-- Initialize user analytics for existing users
INSERT OR IGNORE INTO user_analytics (user_id, computed_at)
SELECT id, strftime('%s', 'now') FROM users;