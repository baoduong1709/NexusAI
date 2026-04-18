ALTER TABLE "projects"
ADD COLUMN "project_roles" TEXT[] NOT NULL DEFAULT ARRAY['Developer', 'Tech Lead', 'Designer', 'Tester', 'PM', 'BA', 'DevOps']::TEXT[];
