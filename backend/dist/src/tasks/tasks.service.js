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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_workflow_1 = require("../projects/project-workflow");
const TASK_INCLUDE = {
    assignee: { select: { id: true, name: true, email: true } },
    project: { select: { id: true, name: true, taskStatuses: true, taskWorkflow: true } },
};
function getStatusOrder(status, taskStatuses) {
    const index = taskStatuses.indexOf(status);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
let TasksService = class TasksService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(projectId, dto) {
        const workflowStatus = await this.resolveWorkflowStatus(projectId, dto.status);
        return this.prisma.task.create({
            data: {
                ...dto,
                projectId,
                status: workflowStatus,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            },
            include: TASK_INCLUDE,
        });
    }
    async findByProject(projectId) {
        const project = await this.getProjectWorkflow(projectId);
        const tasks = await this.prisma.task.findMany({
            where: { projectId },
            include: TASK_INCLUDE,
            orderBy: [{ createdAt: "desc" }],
        });
        return tasks.sort((left, right) => {
            const statusDiff = getStatusOrder(left.status, project.taskStatuses) -
                getStatusOrder(right.status, project.taskStatuses);
            if (statusDiff !== 0)
                return statusDiff;
            return right.createdAt.getTime() - left.createdAt.getTime();
        });
    }
    async findOne(id) {
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: TASK_INCLUDE,
        });
        if (!task)
            throw new common_1.NotFoundException("Task not found");
        return task;
    }
    async update(id, dto) {
        const task = await this.findOne(id);
        const workflowStatus = dto.status !== undefined
            ? await this.resolveWorkflowStatus(task.projectId, dto.status)
            : undefined;
        return this.prisma.task.update({
            where: { id },
            data: {
                ...dto,
                status: workflowStatus,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            },
            include: TASK_INCLUDE,
        });
    }
    async updateStatus(id, dto) {
        const task = await this.findOne(id);
        const project = await this.getProjectWorkflow(task.projectId);
        const workflowStatus = await this.resolveWorkflowStatus(task.projectId, dto.status);
        const workflow = (0, project_workflow_1.normalizeTaskWorkflow)(project.taskWorkflow, project.taskStatuses);
        if (!(0, project_workflow_1.isTaskTransitionAllowed)(workflow, task.status, workflowStatus)) {
            throw new common_1.BadRequestException(`Transition from "${task.status}" to "${workflowStatus}" is not allowed in this workflow`);
        }
        return this.prisma.task.update({
            where: { id },
            data: { status: workflowStatus },
            include: TASK_INCLUDE,
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.task.delete({ where: { id } });
    }
    async bulkCreate(projectId, tasks) {
        const created = await Promise.all(tasks.map((dto) => this.create(projectId, dto)));
        return created;
    }
    async getProjectWorkflow(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, taskStatuses: true, taskWorkflow: true },
        });
        if (!project)
            throw new common_1.NotFoundException("Project not found");
        return project;
    }
    async resolveWorkflowStatus(projectId, status) {
        const project = await this.getProjectWorkflow(projectId);
        const workflow = (0, project_workflow_1.normalizeTaskWorkflow)(project.taskWorkflow, project.taskStatuses);
        const workflowStatus = status?.trim() || (0, project_workflow_1.getDefaultTaskStatus)(workflow);
        if (!project.taskStatuses.includes(workflowStatus)) {
            throw new common_1.BadRequestException(`Status "${workflowStatus}" is not in this project's workflow`);
        }
        return workflowStatus;
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map