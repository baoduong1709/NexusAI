import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateTaskCommentDto,
  CreateTaskDto,
  CreateTaskWorkLogDto,
  UpdateTaskStatusDto,
} from "./dto/create-task.dto";
import {
  getDefaultTaskStatus,
  isTaskTransitionAllowed,
  normalizeTaskWorkflow,
} from "../projects/project-workflow";
import { ProjectAiIndexService } from "../project-ai-index/project-ai-index.service";

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
  project: {
    select: {
      id: true,
      name: true,
      taskStatuses: true,
      taskWorkflow: true,
      epics: true,
      labels: true,
      taskNamingRule: true,
    },
  },
};

function getStatusOrder(status: string, taskStatuses: string[]) {
  const index = taskStatuses.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function stripGeneratedTaskPrefix(title: string) {
  return title.replace(/^(\[[^\]]+\]\s*)+/, "").trim();
}

function renderToken(value: string | null | undefined) {
  return value?.trim() || "";
}

function buildTaskTitle(
  rule: string | null | undefined,
  task: Pick<CreateTaskDto, "title" | "epic" | "labels" | "sprint" | "priority">,
) {
  const rawTitle = stripGeneratedTaskPrefix(task.title || "");
  if (!rule?.trim()) return rawTitle;

  const labels = task.labels || [];
  const firstLabel = labels[0] || "";
  const remainingLabels = labels.slice(1).join("][");
  const allLabels = labels.join("][");

  const rendered = rule
    .replaceAll("{title}", rawTitle)
    .replaceAll("{epic}", renderToken(task.epic))
    .replaceAll("{labels}", allLabels)
    .replaceAll("{firstLabel}", firstLabel)
    .replaceAll("{remainingLabels}", remainingLabels)
    .replaceAll("{sprint}", renderToken(task.sprint))
    .replaceAll("{priority}", renderToken(task.priority));

  return rendered
    .replace(/\[\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,\]])/g, "$1")
    .trim();
}

function buildProjectTaskPrefix(projectName: string) {
  return (
    projectName
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 8) || "PRJ"
  );
}

const TRACKED_TASK_FIELDS = [
  "title",
  "description",
  "assigneeId",
  "status",
  "priority",
  "dueDate",
  "epic",
  "labels",
  "sprint",
  "estimateHours",
  "loggedHours",
] as const;

function serializeActivityValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function valuesEqual(left: unknown, right: unknown) {
  return serializeActivityValue(left) === serializeActivityValue(right);
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private projectAiIndex: ProjectAiIndexService,
  ) {}

  async create(projectId: number, dto: CreateTaskDto, userId?: number) {
    const workflowStatus = await this.resolveWorkflowStatus(projectId, dto.status);
    const projectMetadata = await this.validateTaskMetadata(projectId, dto);
    const title = buildTaskTitle(projectMetadata.taskNamingRule, dto);

    const task = await this.prisma.$transaction(async (tx) => {
      const latestTask = await tx.task.findFirst({
        where: { projectId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      let sequence = (latestTask?.sequence ?? 0) + 1;
      const prefix = buildProjectTaskPrefix(projectMetadata.name);
      let id = `${prefix}-${sequence}`;
      while (await tx.task.findUnique({ where: { id }, select: { id: true } })) {
        sequence += 1;
        id = `${prefix}-${sequence}`;
      }
      const created = await tx.task.create({
        data: {
          ...dto,
          id,
          sequence,
          title,
          projectId,
          status: workflowStatus,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
        include: TASK_INCLUDE,
      });

      await (tx as any).taskActivity.create({
        data: {
          taskId: created.id,
          userId,
          type: "HISTORY",
          body: "Task created",
        },
      });

      return created;
    });

    this.projectAiIndex.rebuildSoon(projectId);
    return task;
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

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  async update(id: string, dto: Partial<CreateTaskDto>, userId?: number) {
    const task = await this.findOne(id);
    const workflowStatus =
      dto.status !== undefined
        ? await this.resolveWorkflowStatus(task.projectId, dto.status)
        : undefined;
    const projectMetadata = await this.validateTaskMetadata(task.projectId, dto);
    const mergedForTitle = {
      title: dto.title ?? task.title,
      epic: dto.epic ?? task.epic ?? undefined,
      labels: dto.labels ?? task.labels,
      sprint: dto.sprint ?? task.sprint ?? undefined,
      priority: dto.priority ?? task.priority,
    };

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        title:
          dto.title !== undefined ||
          dto.epic !== undefined ||
          dto.labels !== undefined ||
          dto.sprint !== undefined ||
          dto.priority !== undefined
            ? buildTaskTitle(projectMetadata.taskNamingRule, mergedForTitle)
            : undefined,
        status: workflowStatus,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: TASK_INCLUDE,
    });

    const changes = TRACKED_TASK_FIELDS.flatMap((field) => {
      const before = (task as any)[field];
      const after = (updated as any)[field];
      if (valuesEqual(before, after)) return [];
      const loggedDelta = toNumber(after) - toNumber(before);
      return {
        taskId: id,
        userId,
        type: field === "loggedHours" && loggedDelta > 0 ? "WORK_LOG" : "HISTORY",
        field,
        fromValue: serializeActivityValue(before),
        toValue: serializeActivityValue(after),
        durationHours:
          field === "loggedHours" && loggedDelta > 0 ? loggedDelta : undefined,
      };
    });

    if (changes.length) {
      await (this.prisma as any).taskActivity.createMany({ data: changes });
    }

    this.projectAiIndex.rebuildSoon(task.projectId);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto, userId?: number) {
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

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: workflowStatus },
      include: TASK_INCLUDE,
    });

    if (task.status !== updated.status) {
      await this.createActivity({
        taskId: id,
        userId,
        type: "HISTORY",
        field: "status",
        fromValue: task.status,
        toValue: updated.status,
      });
    }

    this.projectAiIndex.rebuildSoon(task.projectId);
    return updated;
  }

  async remove(id: string) {
    const task = await this.findOne(id);
    const removed = await this.prisma.task.delete({ where: { id } });
    this.projectAiIndex.rebuildSoon(task.projectId);
    return removed;
  }

  async bulkCreate(projectId: number, tasks: CreateTaskDto[]) {
    const created = [];
    for (const dto of tasks) {
      created.push(await this.create(projectId, dto));
    }
    return created;
  }

  async getActivities(projectId: number, taskId: string) {
    await this.ensureTaskInProject(projectId, taskId);

    return (this.prisma as any).taskActivity.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async addComment(
    projectId: number,
    taskId: string,
    userId: number | undefined,
    dto: CreateTaskCommentDto,
  ) {
    await this.ensureTaskInProject(projectId, taskId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Comment cannot be empty");

    return this.createActivity({
      taskId,
      userId,
      type: "COMMENT",
      body,
    });
  }

  async addWorkLog(
    projectId: number,
    taskId: string,
    userId: number | undefined,
    dto: CreateTaskWorkLogDto,
  ) {
    await this.ensureTaskInProject(projectId, taskId);

    const activity = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: taskId },
        data: { loggedHours: { increment: dto.durationHours } },
        select: { loggedHours: true },
      });

      const activity = await (tx as any).taskActivity.create({
        data: {
          taskId,
          userId,
          type: "WORK_LOG",
          field: "loggedHours",
          body: dto.note?.trim() || null,
          durationHours: dto.durationHours,
          toValue: serializeActivityValue(task.loggedHours),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return activity;
    });

    this.projectAiIndex.rebuildSoon(projectId);
    return activity;
  }

  private async getProjectWorkflow(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, taskStatuses: true, taskWorkflow: true },
    });

    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  private async validateTaskMetadata(projectId: number, dto: Partial<CreateTaskDto>) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, epics: true, labels: true, taskNamingRule: true },
    });

    if (!project) throw new NotFoundException("Project not found");

    let updatedEpics = [...project.epics];
    let updatedLabels = [...project.labels];
    let projectNeedsUpdate = false;

    // Automatically append new epic if it does not exist in the project
    if (dto.epic && !project.epics.includes(dto.epic)) {
      updatedEpics.push(dto.epic);
      projectNeedsUpdate = true;
    }

    // Automatically append any new labels that do not exist in the project
    const unknownLabels = (dto.labels || []).filter(
      (label) => !project.labels.includes(label),
    );
    if (unknownLabels.length) {
      updatedLabels.push(...unknownLabels);
      projectNeedsUpdate = true;
    }

    if (projectNeedsUpdate) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          epics: updatedEpics,
          labels: updatedLabels,
        },
      });
      // Update local object to reflect database changes
      project.epics = updatedEpics;
      project.labels = updatedLabels;
    }

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

  private async ensureTaskInProject(projectId: number, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true },
    });

    if (!task) throw new NotFoundException("Task not found");
  }

  private createActivity(data: {
    taskId: string;
    userId?: number;
    type: "COMMENT" | "HISTORY" | "WORK_LOG";
    field?: string;
    fromValue?: string | null;
    toValue?: string | null;
    body?: string | null;
    durationHours?: number;
  }) {
    return (this.prisma as any).taskActivity.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
