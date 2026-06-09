import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { AiModule } from "../ai/ai.module";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";

@Module({
  imports: [AiModule, ProjectAiIndexModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
