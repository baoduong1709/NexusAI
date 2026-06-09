import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";

@Module({
  imports: [ProjectAiIndexModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
