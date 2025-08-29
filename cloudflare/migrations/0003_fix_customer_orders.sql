-- Fix customer_orders table structure
-- Drop the existing table and recreate with correct structure

DROP TABLE IF EXISTS customer_orders;

CREATE TABLE customer_orders (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  contributed_amount REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Create index for better performance
CREATE INDEX idx_customer_orders_customer_id ON customer_orders(customer_id);
CREATE INDEX idx_customer_orders_order_id ON customer_orders(order_id);