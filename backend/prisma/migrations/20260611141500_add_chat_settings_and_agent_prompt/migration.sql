-- AlterTable
ALTER TABLE "users" ADD COLUMN "chat_language" TEXT NOT NULL DEFAULT 'vi',
ADD COLUMN "chat_description" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "agent_prompt" TEXT;
