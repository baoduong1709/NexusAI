import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { ConfirmAiTasksDto, SuggestAssigneeDto, AiChatDto } from "./dto/ai.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("analyze")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Analyze project documents and suggest tasks" })
  analyze(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.aiService.analyzeProject(projectId);
  }

  @Get("requirements")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Get current requirements content" })
  getRequirements(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.aiService.getRequirementsContent(projectId);
  }

  @Get("requirements/history")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Get requirements version history" })
  getHistory(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.aiService.getRequirementsHistory(projectId);
  }

  @Get("requirements/version/:historyId")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Get content of a specific requirements version" })
  getVersion(@Param("historyId", ParseIntPipe) historyId: number) {
    return this.aiService.getRequirementsVersion(historyId);
  }

  @Post("requirements/update")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Re-analyze documents and update requirements.md" })
  updateRequirements(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.aiService.updateRequirements(projectId);
  }

  @Post("confirm-tasks")
  @RequirePermissions("task:approve_ai")
  @ApiOperation({ summary: "Confirm AI-generated tasks and add to project" })
  confirmTasks(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: ConfirmAiTasksDto,
  ) {
    return this.aiService.confirmAndCreateTasks(projectId, dto.tasks);
  }

  @Post("suggest-assignee")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Get AI-suggested assignees for a task" })
  suggestAssignee(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: SuggestAssigneeDto,
  ) {
    return this.aiService.suggestAssignees(projectId, dto.taskDescription);
  }

  @Post("chat")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Chat with AI to manage project tasks" })
  chat(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: AiChatDto,
  ) {
    return this.aiService.chat(projectId, dto.messages);
  }
}
