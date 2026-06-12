import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AiController } from "./ai.controller";
import { SystemConfigsController } from "./system-configs.controller";
import { TokenStatsController } from "./token-stats.controller";
import { AiService } from "./ai.service";
import { AiDataAccessService } from "./ai-data-access.service";
import { TasksModule } from "../tasks/tasks.module";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { RagService } from "./rag.service";
import { WebsocketModule } from "../common/websocket/websocket.module";
import { AiProcessor } from "./ai.processor";

@Module({
  imports: [
    TasksModule,
    ProjectAiIndexModule,
    WebsocketModule,
    BullModule.registerQueue({
      name: "ai",
    }),
  ],
  controllers: [AiController, SystemConfigsController, TokenStatsController],
  providers: [AiService, AiDataAccessService, RagService, AiProcessor],
  exports: [AiService, RagService],
})
export class AiModule {}