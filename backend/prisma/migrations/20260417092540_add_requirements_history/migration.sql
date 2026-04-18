-- CreateTable
CREATE TABLE "requirements_history" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirements_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "requirements_history" ADD CONSTRAINT "requirements_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
