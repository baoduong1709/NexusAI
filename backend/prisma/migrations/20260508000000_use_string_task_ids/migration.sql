-- Convert task primary keys from integer ids to human-readable project task ids
-- such as GLAPP-1. Existing tasks are numbered by creation order per project.

ALTER TABLE "task_activities" DROP CONSTRAINT "task_activities_task_id_fkey";

ALTER TABLE "tasks" ADD COLUMN "sequence" INTEGER;
ALTER TABLE "tasks" ADD COLUMN "new_id" TEXT;

WITH task_prefixes AS (
  SELECT
    t."id",
    t."project_id",
    t."created_at",
    COALESCE(
      NULLIF(
        SUBSTRING(
          UPPER(REGEXP_REPLACE(p."name", '[^A-Za-z0-9]+', '', 'g'))
          FROM 1 FOR 8
        ),
        ''
      ),
      'PRJ'
    ) AS project_prefix
  FROM "tasks" t
  INNER JOIN "projects" p ON p."id" = t."project_id"
),
numbered_tasks AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY project_prefix
      ORDER BY "project_id" ASC, "created_at" ASC, "id" ASC
    ) AS task_sequence,
    project_prefix
  FROM task_prefixes
)
UPDATE "tasks" t
SET
  "sequence" = numbered_tasks.task_sequence,
  "new_id" = numbered_tasks.project_prefix || '-' || numbered_tasks.task_sequence
FROM numbered_tasks
WHERE numbered_tasks."id" = t."id";

ALTER TABLE "task_activities" ADD COLUMN "new_task_id" TEXT;

UPDATE "task_activities" a
SET "new_task_id" = t."new_id"
FROM "tasks" t
WHERE a."task_id" = t."id";

ALTER TABLE "task_activities" DROP COLUMN "task_id";
ALTER TABLE "task_activities" RENAME COLUMN "new_task_id" TO "task_id";

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_pkey";
ALTER TABLE "tasks" DROP COLUMN "id";
ALTER TABLE "tasks" RENAME COLUMN "new_id" TO "id";

ALTER TABLE "tasks" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "sequence" SET NOT NULL;
ALTER TABLE "task_activities" ALTER COLUMN "task_id" SET NOT NULL;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "tasks_project_id_sequence_key" ON "tasks"("project_id", "sequence");
CREATE INDEX "task_activities_task_id_created_at_idx" ON "task_activities"("task_id", "created_at");

ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
