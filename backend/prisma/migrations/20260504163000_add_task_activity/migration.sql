-- CreateEnum
CREATE TYPE "TaskActivityType" AS ENUM ('COMMENT', 'HISTORY', 'WORK_LOG');

-- CreateTable
CREATE TABLE "task_activities" (
  "id" SERIAL NOT NULL,
  "task_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "type" "TaskActivityType" NOT NULL,
  "field" TEXT,
  "from_value" TEXT,
  "to_value" TEXT,
  "body" TEXT,
  "duration_hours" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_activities_task_id_created_at_idx" ON "task_activities"("task_id", "created_at");

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
