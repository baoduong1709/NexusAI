-- CreateTable
CREATE TABLE "project_ai_embeddings" (
    "id" SERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_ai_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_ai_embeddings_project_id_idx" ON "project_ai_embeddings"("project_id");

-- CreateIndex
CREATE INDEX "project_ai_embeddings_document_id_idx" ON "project_ai_embeddings"("document_id");

-- AddForeignKey
ALTER TABLE "project_ai_embeddings" ADD CONSTRAINT "project_ai_embeddings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
