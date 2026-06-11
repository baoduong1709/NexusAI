-- AlterTable: Add folder and uploaded_by_id to documents
ALTER TABLE "documents"
ADD COLUMN "folder" TEXT,
ADD COLUMN "uploaded_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "documents"
ADD CONSTRAINT "documents_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
