import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import {
  CreateTaskCommentDto,
  CreateTaskDto,
  CreateTaskWorkLogDto,
  UpdateTaskStatusDto,
} from "./dto/create-task.dto";
import { TasksQueryDto } from "./dto/tasks-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermissions("task:create")
  @ApiOperation({ summary: "Create task in project" })
  create(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.tasksService.create(projectId, dto, user?.id);
  }

  @Get()
  @RequirePermissions("task:read")
  @ApiOperation({ summary: "Get paginated tasks in project with optional filters" })
  findAll(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Query() query: TasksQueryDto,
  ) {
    return this.tasksService.findByProject(projectId, query);
  }

  @Get(":id")
  @RequirePermissions("task:read")
  findOne(@Param("id") id: string) {
    return this.tasksService.findOne(id);
  }

  @Put(":id")
  @RequirePermissions("task:update")
  update(
    @Param("id") id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.tasksService.update(id, dto, user?.id);
  }

  @Patch(":id/status")
  @RequirePermissions("task:update")
  @ApiOperation({ summary: "Update task status" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.tasksService.updateStatus(id, dto, user?.id);
  }

  @Get(":id/activities")
  @RequirePermissions("task:read")
  @ApiOperation({ summary: "Get task activity" })
  getActivities(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("id") id: string,
  ) {
    return this.tasksService.getActivities(projectId, id);
  }

  @Post(":id/comments")
  @RequirePermissions("task:update")
  @ApiOperation({ summary: "Add task comment" })
  addComment(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("id") id: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.tasksService.addComment(projectId, id, user?.id, dto);
  }

  @Post(":id/worklogs")
  @RequirePermissions("task:update")
  @ApiOperation({ summary: "Add task work log" })
  addWorkLog(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("id") id: string,
    @Body() dto: CreateTaskWorkLogDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.tasksService.addWorkLog(projectId, id, user?.id, dto);
  }

  @Delete(":id")
  @RequirePermissions("task:delete")
  remove(@Param("id") id: string) {
    return this.tasksService.remove(id);
  }
}
