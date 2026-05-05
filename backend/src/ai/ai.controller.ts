import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import {
  ConfirmAiTasksDto,
  SuggestAssigneeDto,
  ImproveDescriptionDto,
  AssistDescriptionDto,
  AiChatDto,
  AiSummarizeDto,
  CreateSessionDto,
  UpdateSessionDto,
} from "./dto/ai.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("analyze")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Analyze project documents and suggest tasks" })
  analyze(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.analyzeProject(projectId, user.id);
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
  updateRequirements(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.updateRequirements(projectId, user.id);
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
    @CurrentUser() user: { id: number },
    @Body() dto: SuggestAssigneeDto,
  ) {
    return this.aiService.suggestAssignees(
      projectId,
      dto.taskDescription,
      user.id,
    );
  }

  @Post("description/improve")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Improve task description with AI" })
  improveDescription(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: ImproveDescriptionDto,
  ) {
    return this.aiService.improveTaskDescription(
      projectId,
      user.id,
      dto.description,
      dto.title,
    );
  }

  @Post("description/assist")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Assist task description by instruction" })
  assistDescription(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: AssistDescriptionDto,
  ) {
    return this.aiService.assistTaskDescription(
      projectId,
      user.id,
      dto.description,
      dto.instruction,
      dto.title,
    );
  }

  @Post("chat")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Chat with AI to manage project tasks" })
  chat(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: AiChatDto,
  ) {
    return this.aiService.chat(projectId, user.id, dto.messages, dto.summary);
  }

  @Post("summarize")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Summarize chat history into a compressed memory" })
  summarize(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: AiSummarizeDto,
  ) {
    return this.aiService.summarize(
      projectId,
      dto.currentSummary || "",
      dto.messages,
    );
  }

  // ── Session CRUD ──────────────────────────────────────────────────────────

  @Get("sessions")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "List chat sessions for current user and project" })
  listSessions(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.listSessions(projectId, user.id);
  }

  @Post("sessions")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Create a new chat session" })
  createSession(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateSessionDto,
  ) {
    return this.aiService.createSession(projectId, user.id, dto.name);
  }

  @Put("sessions/:sessionId")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Update a chat session (name, summary, messages)" })
  updateSession(
    @Param("sessionId", ParseIntPipe) sessionId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateSessionDto,
  ) {
    return this.aiService.updateSession(sessionId, user.id, dto);
  }

  @Delete("sessions/:sessionId")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Delete a chat session" })
  deleteSession(
    @Param("sessionId", ParseIntPipe) sessionId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.deleteSession(sessionId, user.id);
  }
}
