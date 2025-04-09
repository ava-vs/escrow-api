-- Migration: Acts and Documents relationship - simplified for Neon DB

-- Clean up any orphaned acts
DELETE FROM "acts" WHERE "id" NOT IN (SELECT "id" FROM "documents" WHERE "type" = 'ACT_OF_WORK');

-- Add document_id column to acts table
ALTER TABLE "acts" ADD COLUMN IF NOT EXISTS "document_id" text;

-- Update document_id to match id (they should be the same currently)
UPDATE "acts" SET "document_id" = "id" WHERE "document_id" IS NULL;

-- Make document_id NOT NULL
ALTER TABLE "acts" ALTER COLUMN "document_id" SET NOT NULL;

-- Add foreign key constraint with cascade delete
ALTER TABLE "acts" 
ADD CONSTRAINT "acts_document_id_fkey" 
FOREIGN KEY ("document_id") 
REFERENCES "documents"("id") 
ON DELETE CASCADE;

-- Create index for faster joins
CREATE INDEX IF NOT EXISTS "idx_acts_document_id" ON "acts"("document_id");

-- Миграция для добавления значения ACT_OF_WORK в enum document_type
-- и обновления enum act_status для соответствия коду

-- Добавляем ACT_OF_WORK в document_type enum
ALTER TYPE "document_type" ADD VALUE 'ACT_OF_WORK';

-- Добавляем значения в milestone_status enum
ALTER TYPE "milestone_status" ADD VALUE 'AWAITING_ACCEPTANCE';
ALTER TYPE "milestone_status" ADD VALUE 'REJECTED';

-- Обновляем act_status enum для соответствия коду
ALTER TYPE "act_status" RENAME TO "act_status_old";
CREATE TYPE "act_status" AS ENUM ('CREATED', 'SIGNED_CONTRACTOR', 'SIGNED_CUSTOMER', 'COMPLETED', 'REJECTED');

-- Обновление существующих данных
ALTER TABLE "acts" 
  ALTER COLUMN "status" TYPE "act_status" 
  USING CASE
    WHEN "status"::text = 'CONTRACTOR_SIGNED' THEN 'SIGNED_CONTRACTOR'::act_status
    ELSE "status"::text::act_status
  END;

-- Удаление старого типа
DROP TYPE "act_status_old";

-- Добавляем поле document_id в таблицу acts, если его не существует
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'acts' AND column_name = 'document_id'
  ) THEN
    ALTER TABLE "acts" ADD COLUMN "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE;
    -- Заполняем document_id для существующих записей
    UPDATE "acts" SET "document_id" = "id" WHERE "document_id" IS NULL;
  END IF;
END
$$;
