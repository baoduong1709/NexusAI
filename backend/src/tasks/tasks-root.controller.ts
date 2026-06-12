import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Tasks Root")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksRootController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(":id")
  @ApiOperation({ summary: "Get task details by globally unique ID" })
  async findOne(@Param("id") id: string, @Req() req: any) {
    const task = await this.tasksService.findOne(id);
    const user = req.user;
    const userPermissions: string[] = user?.permissions || [];

    // If the user has global permission to read all tasks, allow access
    if (userPermissions.includes("task:read")) {
      return task;
    }

    // Otherwise, verify if the user is a member of the project containing the task
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this task");
    }

    return task;
  }
}
