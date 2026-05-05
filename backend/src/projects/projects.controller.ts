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
import { ProjectsService } from "./projects.service";
import { CreateProjectDto, UpdateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectWorkflowDto } from "./dto/update-project-workflow.dto";
import { UpdateProjectRolesDto } from "./dto/update-project-roles.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions("project:create")
  @ApiOperation({ summary: "Create a project" })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all projects" })
  findAll(@CurrentUser() user: { id: number; permissions?: string[] }) {
    return this.projectsService.findAll(user);
  }

  @Get(":id")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Get project detail" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Put(":id")
  @RequirePermissions("project:update")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Patch(":id/workflow")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update project task workflow" })
  updateWorkflow(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProjectWorkflowDto,
  ) {
    return this.projectsService.updateWorkflow(id, dto);
  }

  @Patch(":id/roles")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update project member roles" })
  updateRoles(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProjectRolesDto,
  ) {
    return this.projectsService.updateRoles(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("project:delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }

  @Post(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Add member to project" })
  addMember(
    @Param("id", ParseIntPipe) id: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: { projectRole?: string },
  ) {
    return this.projectsService.addMember(id, userId, body?.projectRole);
  }

  @Patch(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update member project role" })
  updateMemberRole(
    @Param("id", ParseIntPipe) id: number,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: { projectRole: string },
  ) {
    return this.projectsService.updateMemberRole(id, userId, body.projectRole);
  }

  @Delete(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Remove member from project" })
  removeMember(
    @Param("id", ParseIntPipe) id: number,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    return this.projectsService.removeMember(id, userId);
  }
}
