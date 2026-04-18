ALTER TABLE "projects"
ADD COLUMN "project_role_configs" JSONB NOT NULL DEFAULT '[]'::jsonb;
