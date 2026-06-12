-- DropForeignKey
ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT "ai_chat_sessions_project_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_fkey";

-- DropForeignKey
ALTER TABLE "project_ai_indexes" DROP CONSTRAINT "project_ai_indexes_project_id_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_project_id_fkey";

-- DropForeignKey
ALTER TABLE "requirements_history" DROP CONSTRAINT "requirements_history_project_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_fkey";

-- AlterTable
ALTER TABLE "ai_chat_sessions" ALTER COLUMN "project_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "project_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "project_ai_indexes" DROP CONSTRAINT "project_ai_indexes_pkey",
ALTER COLUMN "project_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "project_ai_indexes_pkey" PRIMARY KEY ("project_id");

-- AlterTable
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_pkey",
ALTER COLUMN "project_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id");

-- AlterTable
ALTER TABLE "projects" DROP CONSTRAINT "projects_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "projects_id_seq";

-- AlterTable
ALTER TABLE "requirements_history" ALTER COLUMN "project_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "project_id" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "ai_chat_sessions_project_id_user_id_idx" ON "ai_chat_sessions"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_token_logs_user_id_created_at_idx" ON "ai_token_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_project_id_folder_idx" ON "documents"("project_id", "folder");

-- CreateIndex
CREATE INDEX "documents_uploaded_by_id_idx" ON "documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "requirements_history_project_id_version_idx" ON "requirements_history"("project_id", "version");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- AddForeignKey
ALTER TABLE "project_ai_indexes" ADD CONSTRAINT "project_ai_indexes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements_history" ADD CONSTRAINT "requirements_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
