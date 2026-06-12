import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { WebsocketModule } from "../common/websocket/websocket.module";

@Module({
  imports: [ProjectAiIndexModule, WebsocketModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
