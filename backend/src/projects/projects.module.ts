import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { AiModule } from "../ai/ai.module";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { WebsocketModule } from "../common/websocket/websocket.module";

@Module({
  imports: [AiModule, ProjectAiIndexModule, WebsocketModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
