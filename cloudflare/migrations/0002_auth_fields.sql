-- Migration: Add authentication fields
-- Created: 2025-08-29

-- Add password field to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN last_login INTEGER; -- Timestamp
ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until INTEGER; -- Timestamp

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Timestamp
  used_at INTEGER, -- Timestamp when used
  created_at INTEGER NOT NULL
);

-- User sessions table (backup to KV)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Timestamp
  user_agent TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL,
  last_used INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_users_email_password ON users(email, password_hash);
CREATE INDEX idx_users_last_login ON users(last_login);