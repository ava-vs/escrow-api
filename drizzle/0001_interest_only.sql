-- Migration for Interest Only functionality
-- This migration adds a table to track users interested in purchasing products immediately after completion

-- Create interest_only table to track interested users
CREATE TABLE IF NOT EXISTS "interest_only" (
  "user_id" text NOT NULL,
  "order_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "order_id")
);

-- Add foreign key constraints
ALTER TABLE "interest_only" ADD CONSTRAINT "interest_only_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
  
ALTER TABLE "interest_only" ADD CONSTRAINT "interest_only_order_id_fkey" 
  FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS "idx_interest_only_order_id" ON "interest_only" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_interest_only_user_id" ON "interest_only" ("user_id");
