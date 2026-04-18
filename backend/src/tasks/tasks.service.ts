import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskStatusDto } from "./dto/create-task.dto";
import {
  getDefaultTaskStatus,
  isTaskTransitionAllowed,
  normalizeTaskWorkflow,
} from "../projects/project-workflow";

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, taskStatuses: true, taskWorkflow: true } },
};

function getStatusOrder(status: string, taskStatuses: string[]) {
  const index = taskStatuses.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: number, dto: CreateTaskDto) {
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

  async findByProject(projectId: number) {
    const project = await this.getProjectWorkflow(projectId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: TASK_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    });

    return tasks.sort((left, right) => {
      const statusDiff =
        getStatusOrder(left.status, project.taskStatuses) -
        getStatusOrder(right.status, project.taskStatuses);

      if (statusDiff !== 0) return statusDiff;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  async update(id: number, dto: Partial<CreateTaskDto>) {
    const task = await this.findOne(id);
    const workflowStatus =
      dto.status !== undefined
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

  async updateStatus(id: number, dto: UpdateTaskStatusDto) {
    const task = await this.findOne(id);
    const project = await this.getProjectWorkflow(task.projectId);
    const workflowStatus = await this.resolveWorkflowStatus(
      task.projectId,
      dto.status,
    );

    const workflow = normalizeTaskWorkflow(project.taskWorkflow, project.taskStatuses);
    if (!isTaskTransitionAllowed(workflow, task.status, workflowStatus)) {
      throw new BadRequestException(
        `Transition from "${task.status}" to "${workflowStatus}" is not allowed in this workflow`,
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: workflowStatus },
      include: TASK_INCLUDE,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.task.delete({ where: { id } });
  }

  async bulkCreate(projectId: number, tasks: CreateTaskDto[]) {
    const created = await Promise.all(
      tasks.map((dto) => this.create(projectId, dto)),
    );
    return created;
  }

  private async getProjectWorkflow(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, taskStatuses: true, taskWorkflow: true },
    });

    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  private async resolveWorkflowStatus(projectId: number, status?: string) {
    const project = await this.getProjectWorkflow(projectId);
    const workflow = normalizeTaskWorkflow(project.taskWorkflow, project.taskStatuses);
    const workflowStatus = status?.trim() || getDefaultTaskStatus(workflow);

    if (!project.taskStatuses.includes(workflowStatus)) {
      throw new BadRequestException(
        `Status "${workflowStatus}" is not in this project's workflow`,
      );
    }

    return workflowStatus;
  }
}
