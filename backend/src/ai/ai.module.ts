import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiDataAccessService } from "./ai-data-access.service";
import { TasksModule } from "../tasks/tasks.module";

@Module({
  imports: [TasksModule],
  controllers: [AiController],
  providers: [AiService, AiDataAccessService],
  exports: [AiService],
})
export class AiModule {}
