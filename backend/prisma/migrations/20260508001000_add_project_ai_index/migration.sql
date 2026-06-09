CREATE TABLE "project_ai_indexes" (
  "project_id" INTEGER NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_ai_indexes_pkey" PRIMARY KEY ("project_id")
);

ALTER TABLE "project_ai_indexes" ADD CONSTRAINT "project_ai_indexes_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
