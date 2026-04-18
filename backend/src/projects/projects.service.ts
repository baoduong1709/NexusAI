import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { AiService } from "../ai/ai.service";
import { UpdateProjectWorkflowDto } from "./dto/update-project-workflow.dto";
import { UpdateProjectRolesDto } from "./dto/update-project-roles.dto";
import {
  buildWorkflowRenameMap,
  createDefaultTaskWorkflow,
  getTaskWorkflowStatusNames,
  getWorkflowAsJson,
  normalizeTaskStatuses,
  normalizeTaskWorkflow,
} from "./project-workflow";
import {
  getProjectRolePermissions,
  getProjectRoleNames,
  normalizeProjectRoleConfigs,
  normalizeProjectRole,
  ProjectRoleConfig,
} from "./project-roles";

const PROJECT_INCLUDE = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          skills: true,
          role: { select: { name: true } },
        },
      },
    },
  },
  _count: { select: { tasks: true, documents: true } },
};

function getStatusOrder(status: string, taskStatuses: string[]) {
  const index = taskStatuses.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortTasksByWorkflow<T extends { status: string; createdAt: Date }>(
  tasks: T[],
  taskStatuses: string[],
) {
  return [...tasks].sort((left, right) => {
    const statusDiff =
      getStatusOrder(left.status, taskStatuses) -
      getStatusOrder(right.status, taskStatuses);

    if (statusDiff !== 0) return statusDiff;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function sortProjectRoleConfigs(roleConfigs: ProjectRoleConfig[]) {
  return [...roleConfigs];
}

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(dto: CreateProjectDto) {
    const { memberIds, ...data } = dto;
    const projectRoleConfigs = normalizeProjectRoleConfigs(
      data.projectRoles?.length ? data.projectRoles : undefined,
    );
    const projectRoles = getProjectRoleNames(projectRoleConfigs);
    const taskStatuses = normalizeTaskStatuses(data.taskStatuses);
    const taskWorkflow = createDefaultTaskWorkflow(taskStatuses);
    const project = await this.prisma.project.create({
      data: {
        ...data,
        projectRoles,
        projectRoleConfigs:
          projectRoleConfigs as unknown as Prisma.InputJsonValue,
        taskStatuses,
        taskWorkflow: getWorkflowAsJson(taskWorkflow) as Prisma.InputJsonValue,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        members: memberIds?.length
          ? { create: memberIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: PROJECT_INCLUDE,
    });

    // Auto-create initial requirements.md
    this.aiService
      .initRequirements(
        project.id,
        project.name,
        project.description ?? undefined,
      )
      .catch(() => {
        /* non-blocking */
      });

    return this.attachProjectMetadata(project);
  }

  async findAll(user: { id: number; permissions?: string[] }) {
    const hasGlobalRead = user.permissions?.includes("project:read");
    const projects = hasGlobalRead
      ? await this.prisma.project.findMany({
          include: PROJECT_INCLUDE,
          orderBy: { createdAt: "desc" },
        })
      : (
          await this.prisma.projectMember.findMany({
            where: { userId: user.id },
            include: {
              project: {
                include: PROJECT_INCLUDE,
              },
            },
            orderBy: { joinedAt: "desc" },
          })
        )
          .filter((membership) => {
            const roleConfigs = normalizeProjectRoleConfigs(
              membership.project.projectRoleConfigs,
              membership.project.projectRoles,
            );

            return getProjectRolePermissions(
              roleConfigs,
              membership.projectRole,
            ).includes("project:read");
          })
          .map((membership) => membership.project)
          .filter(
            (project, index, items) =>
              items.findIndex((candidate) => candidate.id === project.id) ===
              index,
          );

    return projects.map((project) => this.attachProjectMetadata(project));
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...PROJECT_INCLUDE,
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    return this.attachProjectMetadata(project, {
      includeTasks: true,
    });
  }

  async update(id: number, dto: Partial<CreateProjectDto>) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        projectRoles: true,
        projectRoleConfigs: true,
        taskStatuses: true,
        taskWorkflow: true,
      },
    });
    if (!existingProject) throw new NotFoundException("Project not found");

    const { memberIds, ...data } = dto;
    const projectRoleConfigs = data.projectRoles?.length
      ? normalizeProjectRoleConfigs(data.projectRoles)
      : undefined;
    const projectRoles = projectRoleConfigs
      ? getProjectRoleNames(projectRoleConfigs)
      : undefined;
    const taskStatuses = data.taskStatuses
      ? normalizeTaskStatuses(data.taskStatuses)
      : undefined;
    const taskWorkflow = taskStatuses
      ? createDefaultTaskWorkflow(taskStatuses)
      : normalizeTaskWorkflow(
          existingProject.taskWorkflow,
          existingProject.taskStatuses,
        );

    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        projectRoles,
        projectRoleConfigs: projectRoleConfigs
          ? (projectRoleConfigs as unknown as Prisma.InputJsonValue)
          : undefined,
        taskStatuses,
        taskWorkflow: taskStatuses
          ? (getWorkflowAsJson(taskWorkflow) as Prisma.InputJsonValue)
          : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: PROJECT_INCLUDE,
    });

    return this.attachProjectMetadata(updatedProject);
  }

  async updateWorkflow(id: number, dto: UpdateProjectWorkflowDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, taskStatuses: true, taskWorkflow: true },
    });

    if (!project) throw new NotFoundException("Project not found");

    const currentWorkflow = normalizeTaskWorkflow(
      project.taskWorkflow,
      project.taskStatuses,
    );
    const nextWorkflow = normalizeTaskWorkflow(
      { nodes: dto.nodes, edges: dto.edges ?? [] },
      project.taskStatuses,
    );
    const taskStatuses = getTaskWorkflowStatusNames(nextWorkflow);
    const renamedStatuses = buildWorkflowRenameMap(
      currentWorkflow,
      nextWorkflow,
    );

    await this.prisma.$transaction(async (tx) => {
      const tempMappings = renamedStatuses.map((status, index) => ({
        ...status,
        temp: `__workflow_tmp__${id}__${index}__`,
      }));

      for (const status of tempMappings) {
        await tx.task.updateMany({
          where: { projectId: id, status: status.from },
          data: { status: status.temp },
        });
      }

      const invalidStatuses = await tx.task.findMany({
        where: {
          projectId: id,
          status: {
            notIn: [
              ...taskStatuses,
              ...tempMappings.map((status) => status.temp),
            ],
          },
        },
        distinct: ["status"],
        select: { status: true },
      });

      if (invalidStatuses.length) {
        throw new BadRequestException(
          `Cannot remove statuses still used by tasks: ${invalidStatuses
            .map((status) => status.status)
            .join(", ")}`,
        );
      }

      await tx.project.update({
        where: { id },
        data: {
          taskStatuses,
          taskWorkflow: getWorkflowAsJson(
            nextWorkflow,
          ) as Prisma.InputJsonValue,
        },
      });

      for (const status of tempMappings) {
        await tx.task.updateMany({
          where: { projectId: id, status: status.temp },
          data: { status: status.to },
        });
      }
    });

    return this.findOne(id);
  }

  async updateRoles(id: number, dto: UpdateProjectRolesDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, projectRoles: true, projectRoleConfigs: true },
    });

    if (!project) throw new NotFoundException("Project not found");

    const nextRoleConfigs = normalizeProjectRoleConfigs(
      dto.roles,
      project.projectRoles,
    );
    const projectRoles = getProjectRoleNames(nextRoleConfigs);
    const currentRoleConfigs = normalizeProjectRoleConfigs(
      project.projectRoleConfigs,
      project.projectRoles,
    );
    const currentRoles = currentRoleConfigs.map((role) => role.name);
    const nextRoleKeys = new Set(
      projectRoles.map((role) => role.toLowerCase()),
    );
    const renamedRoles = currentRoles
      .map((role, index) => ({
        from: role,
        to: projectRoles[index],
      }))
      .filter((role) => role.to && role.from !== role.to) as {
      from: string;
      to: string;
    }[];

    await this.prisma.$transaction(async (tx) => {
      const tempMappings = renamedRoles.map((role, index) => ({
        ...role,
        temp: `__project_role_tmp__${id}__${index}__`,
      }));

      for (const role of tempMappings) {
        await tx.projectMember.updateMany({
          where: { projectId: id, projectRole: role.from },
          data: { projectRole: role.temp },
        });
      }

      const invalidRoles = await tx.projectMember.findMany({
        where: {
          projectId: id,
          projectRole: {
            not: null,
            notIn: [...projectRoles, ...tempMappings.map((role) => role.temp)],
          },
        },
        distinct: ["projectRole"],
        select: { projectRole: true },
      });

      if (invalidRoles.length) {
        throw new BadRequestException(
          `Cannot remove roles still assigned to members: ${invalidRoles
            .map((role) => role.projectRole)
            .filter(Boolean)
            .join(", ")}`,
        );
      }

      await tx.project.update({
        where: { id },
        data: {
          projectRoles,
          projectRoleConfigs:
            nextRoleConfigs as unknown as Prisma.InputJsonValue,
        },
      });

      for (const role of tempMappings) {
        if (!nextRoleKeys.has(role.to.toLowerCase())) continue;
        await tx.projectMember.updateMany({
          where: { projectId: id, projectRole: role.temp },
          data: { projectRole: role.to },
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }

  async addMember(projectId: number, userId: number, projectRole?: string) {
    await this.ensureProjectRoleExists(projectId, projectRole);
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        projectRole: normalizeProjectRole(projectRole),
      },
    });
  }

  async updateMemberRole(
    projectId: number,
    userId: number,
    projectRole: string,
  ) {
    await this.ensureProjectRoleExists(projectId, projectRole);
    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { projectRole: normalizeProjectRole(projectRole) },
    });
  }

  async removeMember(projectId: number, userId: number) {
    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  private async ensureProjectRoleExists(
    projectId: number,
    projectRole?: string,
  ) {
    const normalizedRole = normalizeProjectRole(projectRole);
    if (!normalizedRole) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectRoles: true, projectRoleConfigs: true },
    });

    if (!project) throw new NotFoundException("Project not found");
    const projectRoles = getProjectRoleNames(
      normalizeProjectRoleConfigs(
        project.projectRoleConfigs,
        project.projectRoles,
      ),
    );

    if (!projectRoles.includes(normalizedRole)) {
      throw new BadRequestException(
        `Role "${normalizedRole}" does not exist in this project`,
      );
    }
  }

  private attachProjectMetadata<
    T extends {
      projectRoles: string[];
      projectRoleConfigs: Prisma.JsonValue;
      taskStatuses: string[];
      taskWorkflow: Prisma.JsonValue | null;
      tasks?: Array<{ status: string; createdAt: Date }>;
    },
  >(project: T, options?: { includeTasks?: boolean }) {
    const projectRoleConfigs = sortProjectRoleConfigs(
      normalizeProjectRoleConfigs(
        project.projectRoleConfigs,
        project.projectRoles,
      ),
    );
    const taskWorkflow = normalizeTaskWorkflow(
      project.taskWorkflow,
      project.taskStatuses,
    );

    return {
      ...project,
      projectRoles: getProjectRoleNames(projectRoleConfigs),
      projectRoleConfigs,
      taskWorkflow,
      tasks:
        options?.includeTasks && project.tasks
          ? sortTasksByWorkflow(project.tasks, project.taskStatuses)
          : project.tasks,
    };
  }
}
