-- AlterTable: Add storage_provider to documents
ALTER TABLE "documents"
ADD COLUMN "storage_provider" TEXT;
