import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { SystemConfigsController } from "./system-configs.controller";
import { TokenStatsController } from "./token-stats.controller";
import { AiService } from "./ai.service";
import { AiDataAccessService } from "./ai-data-access.service";
import { TasksModule } from "../tasks/tasks.module";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { RagService } from "./rag.service";

@Module({
  imports: [TasksModule, ProjectAiIndexModule],
  controllers: [AiController, SystemConfigsController, TokenStatsController],
  providers: [AiService, AiDataAccessService, RagService],
  exports: [AiService, RagService],
})
export class AiModule {}