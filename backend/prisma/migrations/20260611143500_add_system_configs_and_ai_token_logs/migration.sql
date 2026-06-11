-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ai_token_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "request_type" TEXT NOT NULL,
    "prompt_length" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
