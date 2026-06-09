import { Module, forwardRef } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { MarkitdownService } from "./markitdown.service";
import { ProjectAiIndexModule } from "../project-ai-index/project-ai-index.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    ProjectAiIndexModule,
    forwardRef(() => AiModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, MarkitdownService],
  exports: [DocumentsService, MarkitdownService],
})
export class DocumentsModule {}
