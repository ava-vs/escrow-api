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
