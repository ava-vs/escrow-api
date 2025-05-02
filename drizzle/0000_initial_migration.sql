-- Initial migration for Escrow API database
-- This migration creates all necessary tables for the application

-- 1. Create all ENUMs first
-- User type enum
CREATE TYPE "user_type" AS ENUM ('CUSTOMER', 'CONTRACTOR', 'PLATFORM');

-- Order status enum
CREATE TYPE "order_status" AS ENUM ('CREATED', 'FUNDED', 'IN_PROGRESS', 'COMPLETED');

-- Milestone status enum
CREATE TYPE "milestone_status" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'PAID');

-- Document type enum
CREATE TYPE "document_type" AS ENUM (
  'DEFINITION_OF_READY', 
  'ROADMAP', 
  'DEFINITION_OF_DONE', 
  'SPECIFICATION', 
  'DELIVERABLE'
);

-- Act status enum
CREATE TYPE "act_status" AS ENUM ('CREATED', 'CONTRACTOR_SIGNED', 'COMPLETED', 'REJECTED');

-- 2. Create base tables without foreign key constraints
-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "type" "user_type" NOT NULL,
  "balance" numeric(10, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "is_group_order" boolean NOT NULL DEFAULT false,
  "representative_id" text,
  "contractor_id" text,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'CREATED',
  "total_amount" numeric(10, 2) NOT NULL,
  "funded_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Milestones table (without foreign key)
CREATE TABLE IF NOT EXISTS "milestones" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "deadline" timestamp NOT NULL,
  "status" "milestone_status" NOT NULL DEFAULT 'PENDING',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Documents table (without foreign keys)
CREATE TABLE IF NOT EXISTS "documents" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL,
  "type" "document_type" NOT NULL,
  "name" text NOT NULL,
  "content" jsonb NOT NULL,
  "created_by" text NOT NULL,
  "approved_by" text[],
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Deliverable extensions table (without foreign keys)
CREATE TABLE IF NOT EXISTS "deliverable_extensions" (
  "document_id" text PRIMARY KEY NOT NULL,
  "phase_id" text,
  "attachments" text[]
);

-- Acts table (without foreign key)
CREATE TABLE IF NOT EXISTS "acts" (
  "id" text PRIMARY KEY NOT NULL,
  "milestone_id" text NOT NULL,
  "deliverable_ids" text[] NOT NULL,
  "status" "act_status" NOT NULL DEFAULT 'CREATED',
  "signed_by" text[],
  "rejection_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- 3. Create junction tables
-- Customer_orders junction table (without foreign keys)
CREATE TABLE IF NOT EXISTS "customer_orders" (
  "customer_id" text NOT NULL,
  "order_id" text NOT NULL,
  PRIMARY KEY ("customer_id", "order_id")
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_milestones_order_id" ON "milestones" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_documents_order_id" ON "documents" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_acts_milestone_id" ON "acts" ("milestone_id");
