import { Module } from "@nestjs/common";
import { ProjectAiIndexService } from "./project-ai-index.service";

@Module({
  providers: [ProjectAiIndexService],
  exports: [ProjectAiIndexService],
})
export class ProjectAiIndexModule {}
