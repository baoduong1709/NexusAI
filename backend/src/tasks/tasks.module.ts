import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksRootController } from "./tasks-root.controller";
import { TasksService } from "./tasks.service";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { WebsocketModule } from "../common/websocket/websocket.module";
import { NotificationModule } from "../notifications/notification.module";

@Module({
  imports: [ProjectAiIndexModule, WebsocketModule, NotificationModule],
  controllers: [TasksController, TasksRootController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

