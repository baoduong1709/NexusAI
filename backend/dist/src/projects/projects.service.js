"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const project_workflow_1 = require("./project-workflow");
const project_roles_1 = require("./project-roles");
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
function getStatusOrder(status, taskStatuses) {
    const index = taskStatuses.indexOf(status);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
function sortTasksByWorkflow(tasks, taskStatuses) {
    return [...tasks].sort((left, right) => {
        const statusDiff = getStatusOrder(left.status, taskStatuses) -
            getStatusOrder(right.status, taskStatuses);
        if (statusDiff !== 0)
            return statusDiff;
        return right.createdAt.getTime() - left.createdAt.getTime();
    });
}
function sortProjectRoleConfigs(roleConfigs) {
    return [...roleConfigs];
}
let ProjectsService = class ProjectsService {
    constructor(prisma, aiService) {
        this.prisma = prisma;
        this.aiService = aiService;
    }
    async create(dto) {
        const { memberIds, ...data } = dto;
        const projectRoleConfigs = (0, project_roles_1.normalizeProjectRoleConfigs)(data.projectRoles?.length ? data.projectRoles : undefined);
        const projectRoles = (0, project_roles_1.getProjectRoleNames)(projectRoleConfigs);
        const taskStatuses = (0, project_workflow_1.normalizeTaskStatuses)(data.taskStatuses);
        const taskWorkflow = (0, project_workflow_1.createDefaultTaskWorkflow)(taskStatuses);
        const project = await this.prisma.project.create({
            data: {
                ...data,
                projectRoles,
                projectRoleConfigs: projectRoleConfigs,
                taskStatuses,
                taskWorkflow: (0, project_workflow_1.getWorkflowAsJson)(taskWorkflow),
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                members: memberIds?.length
                    ? { create: memberIds.map((userId) => ({ userId })) }
                    : undefined,
            },
            include: PROJECT_INCLUDE,
        });
        this.aiService
            .initRequirements(project.id, project.name, project.description ?? undefined)
            .catch(() => {
        });
        return this.attachProjectMetadata(project);
    }
    async findAll(user) {
        const hasGlobalRead = user.permissions?.includes("project:read");
        const projects = hasGlobalRead
            ? await this.prisma.project.findMany({
                include: PROJECT_INCLUDE,
                orderBy: { createdAt: "desc" },
            })
            : (await this.prisma.projectMember.findMany({
                where: { userId: user.id },
                include: {
                    project: {
                        include: PROJECT_INCLUDE,
                    },
                },
                orderBy: { joinedAt: "desc" },
            }))
                .filter((membership) => {
                const roleConfigs = (0, project_roles_1.normalizeProjectRoleConfigs)(membership.project.projectRoleConfigs, membership.project.projectRoles);
                return (0, project_roles_1.getProjectRolePermissions)(roleConfigs, membership.projectRole).includes("project:read");
            })
                .map((membership) => membership.project)
                .filter((project, index, items) => items.findIndex((candidate) => candidate.id === project.id) ===
                index);
        return projects.map((project) => this.attachProjectMetadata(project));
    }
    async findOne(id) {
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
        if (!project)
            throw new common_1.NotFoundException("Project not found");
        return this.attachProjectMetadata(project, {
            includeTasks: true,
        });
    }
    async update(id, dto) {
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
        if (!existingProject)
            throw new common_1.NotFoundException("Project not found");
        const { memberIds, ...data } = dto;
        const projectRoleConfigs = data.projectRoles?.length
            ? (0, project_roles_1.normalizeProjectRoleConfigs)(data.projectRoles)
            : undefined;
        const projectRoles = projectRoleConfigs
            ? (0, project_roles_1.getProjectRoleNames)(projectRoleConfigs)
            : undefined;
        const taskStatuses = data.taskStatuses
            ? (0, project_workflow_1.normalizeTaskStatuses)(data.taskStatuses)
            : undefined;
        const taskWorkflow = taskStatuses
            ? (0, project_workflow_1.createDefaultTaskWorkflow)(taskStatuses)
            : (0, project_workflow_1.normalizeTaskWorkflow)(existingProject.taskWorkflow, existingProject.taskStatuses);
        const updatedProject = await this.prisma.project.update({
            where: { id },
            data: {
                ...data,
                projectRoles,
                projectRoleConfigs: projectRoleConfigs
                    ? projectRoleConfigs
                    : undefined,
                taskStatuses,
                taskWorkflow: taskStatuses
                    ? (0, project_workflow_1.getWorkflowAsJson)(taskWorkflow)
                    : undefined,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
            },
            include: PROJECT_INCLUDE,
        });
        return this.attachProjectMetadata(updatedProject);
    }
    async updateWorkflow(id, dto) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            select: { id: true, taskStatuses: true, taskWorkflow: true },
        });
        if (!project)
            throw new common_1.NotFoundException("Project not found");
        const currentWorkflow = (0, project_workflow_1.normalizeTaskWorkflow)(project.taskWorkflow, project.taskStatuses);
        const nextWorkflow = (0, project_workflow_1.normalizeTaskWorkflow)({ nodes: dto.nodes, edges: dto.edges ?? [] }, project.taskStatuses);
        const taskStatuses = (0, project_workflow_1.getTaskWorkflowStatusNames)(nextWorkflow);
        const renamedStatuses = (0, project_workflow_1.buildWorkflowRenameMap)(currentWorkflow, nextWorkflow);
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
                throw new common_1.BadRequestException(`Cannot remove statuses still used by tasks: ${invalidStatuses
                    .map((status) => status.status)
                    .join(", ")}`);
            }
            await tx.project.update({
                where: { id },
                data: {
                    taskStatuses,
                    taskWorkflow: (0, project_workflow_1.getWorkflowAsJson)(nextWorkflow),
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
    async updateRoles(id, dto) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            select: { id: true, projectRoles: true, projectRoleConfigs: true },
        });
        if (!project)
            throw new common_1.NotFoundException("Project not found");
        const nextRoleConfigs = (0, project_roles_1.normalizeProjectRoleConfigs)(dto.roles, project.projectRoles);
        const projectRoles = (0, project_roles_1.getProjectRoleNames)(nextRoleConfigs);
        const currentRoleConfigs = (0, project_roles_1.normalizeProjectRoleConfigs)(project.projectRoleConfigs, project.projectRoles);
        const currentRoles = currentRoleConfigs.map((role) => role.name);
        const nextRoleKeys = new Set(projectRoles.map((role) => role.toLowerCase()));
        const renamedRoles = currentRoles
            .map((role, index) => ({
            from: role,
            to: projectRoles[index],
        }))
            .filter((role) => role.to && role.from !== role.to);
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
                throw new common_1.BadRequestException(`Cannot remove roles still assigned to members: ${invalidRoles
                    .map((role) => role.projectRole)
                    .filter(Boolean)
                    .join(", ")}`);
            }
            await tx.project.update({
                where: { id },
                data: {
                    projectRoles,
                    projectRoleConfigs: nextRoleConfigs,
                },
            });
            for (const role of tempMappings) {
                if (!nextRoleKeys.has(role.to.toLowerCase()))
                    continue;
                await tx.projectMember.updateMany({
                    where: { projectId: id, projectRole: role.temp },
                    data: { projectRole: role.to },
                });
            }
        });
        return this.findOne(id);
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.project.delete({ where: { id } });
    }
    async addMember(projectId, userId, projectRole) {
        await this.ensureProjectRoleExists(projectId, projectRole);
        return this.prisma.projectMember.create({
            data: {
                projectId,
                userId,
                projectRole: (0, project_roles_1.normalizeProjectRole)(projectRole),
            },
        });
    }
    async updateMemberRole(projectId, userId, projectRole) {
        await this.ensureProjectRoleExists(projectId, projectRole);
        return this.prisma.projectMember.update({
            where: { projectId_userId: { projectId, userId } },
            data: { projectRole: (0, project_roles_1.normalizeProjectRole)(projectRole) },
        });
    }
    async removeMember(projectId, userId) {
        return this.prisma.projectMember.delete({
            where: { projectId_userId: { projectId, userId } },
        });
    }
    async ensureProjectRoleExists(projectId, projectRole) {
        const normalizedRole = (0, project_roles_1.normalizeProjectRole)(projectRole);
        if (!normalizedRole)
            return;
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, projectRoles: true, projectRoleConfigs: true },
        });
        if (!project)
            throw new common_1.NotFoundException("Project not found");
        const projectRoles = (0, project_roles_1.getProjectRoleNames)((0, project_roles_1.normalizeProjectRoleConfigs)(project.projectRoleConfigs, project.projectRoles));
        if (!projectRoles.includes(normalizedRole)) {
            throw new common_1.BadRequestException(`Role "${normalizedRole}" does not exist in this project`);
        }
    }
    attachProjectMetadata(project, options) {
        const projectRoleConfigs = sortProjectRoleConfigs((0, project_roles_1.normalizeProjectRoleConfigs)(project.projectRoleConfigs, project.projectRoles));
        const taskWorkflow = (0, project_workflow_1.normalizeTaskWorkflow)(project.taskWorkflow, project.taskStatuses);
        return {
            ...project,
            projectRoles: (0, project_roles_1.getProjectRoleNames)(projectRoleConfigs),
            projectRoleConfigs,
            taskWorkflow,
            tasks: options?.includeTasks && project.tasks
                ? sortTasksByWorkflow(project.tasks, project.taskStatuses)
                : project.tasks,
        };
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map