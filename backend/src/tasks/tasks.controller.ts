import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { CreateTaskDto, UpdateTaskStatusDto } from "./dto/create-task.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

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
  ) {
    return this.tasksService.create(projectId, dto);
  }

  @Get()
  @RequirePermissions("task:read")
  @ApiOperation({ summary: "Get all tasks in project" })
  findAll(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.tasksService.findByProject(projectId);
  }

  @Get(":id")
  @RequirePermissions("task:read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @Put(":id")
  @RequirePermissions("task:update")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("task:update")
  @ApiOperation({ summary: "Update task status" })
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("task:delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
