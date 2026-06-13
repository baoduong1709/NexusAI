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
import { AddMemberDto, UpdateMemberRoleDto } from "./dto/member.dto";
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
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all projects" })
  findAll(@CurrentUser() user: { id: number; permissions?: string[] }) {
    return this.projectsService.findAll(user);
  }

  @Get(":id")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Get project detail" })
  findOne(@CurrentUser() user: any, @Param("id") id: string) {
    return this.projectsService.findOne(id, user.companyId);
  }

  @Put(":id")
  @RequirePermissions("project:update")
  update(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, user.companyId, dto);
  }

  @Patch(":id/workflow")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update project task workflow" })
  updateWorkflow(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() dto: UpdateProjectWorkflowDto,
  ) {
    return this.projectsService.updateWorkflow(id, user.companyId, dto);
  }

  @Patch(":id/roles")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update project member roles" })
  updateRoles(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() dto: UpdateProjectRolesDto,
  ) {
    return this.projectsService.updateRoles(id, user.companyId, dto);
  }

  @Delete(":id")
  @RequirePermissions("project:delete")
  remove(@CurrentUser() user: any, @Param("id") id: string) {
    return this.projectsService.remove(id, user.companyId);
  }

  @Post(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Add member to project" })
  addMember(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(id, user.companyId, userId, dto.projectRole);
  }

  @Patch(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update member project role" })
  updateMemberRole(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.projectsService.updateMemberRole(id, user.companyId, userId, dto.projectRole);
  }

  @Delete(":id/members/:userId")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Remove member from project" })
  removeMember(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    return this.projectsService.removeMember(id, user.companyId, userId);
  }
}
