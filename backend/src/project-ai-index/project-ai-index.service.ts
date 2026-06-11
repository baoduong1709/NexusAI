import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type EpicIndexStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

function isDoneStatus(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "DONE" || normalized === "COMPLETED";
}

function isInProgressStatus(status: string) {
  return status.toUpperCase().includes("PROGRESS");
}

function isBlockedStatus(status: string) {
  const normalized = status.toUpperCase();
  return normalized.includes("BLOCK") || normalized.includes("HOLD");
}

function compactKeyword(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

@Injectable()
export class ProjectAiIndexService {
  private readonly logger = new Logger(ProjectAiIndexService.name);

  // Debounce and concurrency queue controls
  private rebuildTimeouts = new Map<number, NodeJS.Timeout>();
  private rebuildPromises = new Map<number, Promise<any>>();
  private nextRebuildQueued = new Map<number, boolean>();

  constructor(private prisma: PrismaService) {}

  async get(projectId: number) {
    const index = await this.prisma.projectAiIndex.findUnique({
      where: { projectId },
    });
    return index?.data ?? null;
  }

  async rebuild(projectId: number) {
    try {
      const [project, tasks, documents, latestRequirements] =
        await Promise.all([
          this.prisma.project.findUnique({
            where: { id: projectId },
            select: {
              id: true,
              name: true,
              status: true,
              epics: true,
              labels: true,
              taskStatuses: true,
              updatedAt: true,
            },
          }),
          this.prisma.task.findMany({
            where: { projectId },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              epic: true,
              labels: true,
              assigneeId: true,
              dueDate: true,
              updatedAt: true,
              createdAt: true,
            },
          }),
          this.prisma.document.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              size: true,
              createdAt: true,
            },
          }),
          this.prisma.requirementsHistory.findFirst({
            where: { projectId },
            orderBy: { version: "desc" },
            select: {
              version: true,
              changesSummary: true,
              content: true,
              createdAt: true,
            },
          }),
        ]);

      if (!project) return null;

      const now = new Date();
      const allEpicNames = Array.from(
        new Set([
          ...project.epics,
          ...tasks.map((task) => task.epic).filter(Boolean),
          "Unassigned",
        ] as string[]),
      );
      const taskStatusBreakdown = tasks.reduce<Record<string, number>>(
        (counts, task) => {
          counts[task.status] = (counts[task.status] || 0) + 1;
          return counts;
        },
        {},
      );
      const epics = allEpicNames.map((name) => {
        const epicTasks = tasks.filter(
          (task) => (task.epic || "Unassigned") === name,
        );
        const taskCount = epicTasks.length;
        const doneCount = epicTasks.filter((task) =>
          isDoneStatus(task.status),
        ).length;
        const inProgressCount = epicTasks.filter((task) =>
          isInProgressStatus(task.status),
        ).length;
        const blockedCount = epicTasks.filter((task) =>
          isBlockedStatus(task.status),
        ).length;
        const todoCount = taskCount - doneCount - inProgressCount - blockedCount;
        const assigneeIds = Array.from(
          new Set(
            epicTasks
              .map((task) => task.assigneeId)
              .filter((id): id is number => typeof id === "number"),
          ),
        );
        const keywords = Array.from(
          new Set([
            compactKeyword(name),
            ...epicTasks.flatMap((task) => [
              compactKeyword(task.title),
              ...task.labels.map(compactKeyword),
            ]),
          ]),
        ).filter(Boolean).slice(0, 30);
        const lastActivityAt =
          epicTasks[0]?.updatedAt ?? epicTasks[0]?.createdAt ?? null;
        let status: EpicIndexStatus = "NOT_STARTED";
        if (taskCount > 0 && doneCount === taskCount) status = "DONE";
        else if (blockedCount > 0) status = "BLOCKED";
        else if (inProgressCount > 0 || doneCount > 0) status = "IN_PROGRESS";

        return {
          name,
          status,
          taskCount,
          doneCount,
          inProgressCount,
          blockedCount,
          todoCount: Math.max(0, todoCount),
          assigneeIds,
          keywords,
          lastActivityAt,
        };
      });
      const labels = Array.from(new Set([...project.labels, ...tasks.flatMap((task) => task.labels)]))
        .filter(Boolean)
        .map((name) => {
          const labelTasks = tasks.filter((task) => task.labels.includes(name));
          return {
            name,
            taskCount: labelTasks.length,
            statusBreakdown: labelTasks.reduce<Record<string, number>>(
              (counts, task) => {
                counts[task.status] = (counts[task.status] || 0) + 1;
                return counts;
              },
              {},
            ),
          };
        });
      const activeMembers = Array.from(
        new Set(
          tasks
            .filter((task) => !isDoneStatus(task.status))
            .map((task) => task.assigneeId)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      const recentTaskIds = tasks.slice(0, 30).map((task) => task.id);
      const blockedTaskIds = tasks
        .filter((task) => isBlockedStatus(task.status))
        .slice(0, 30)
        .map((task) => task.id);
      const overdueTaskIds = tasks
        .filter(
          (task) =>
            task.dueDate &&
            task.dueDate < now &&
            !isDoneStatus(task.status),
        )
        .slice(0, 30)
        .map((task) => task.id);
      // Read current index to preserve documentEmbeddings and documentSummaries
      const existingIndex = await this.prisma.projectAiIndex.findUnique({
        where: { projectId },
      });
      const existingData = (existingIndex?.data as any) || {};

      const data = {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          taskStatuses: project.taskStatuses,
          updatedAt: project.updatedAt,
        },
        epics,
        labels,
        taskStatusBreakdown,
        activeMembers,
        recentTaskIds,
        blockedTaskIds,
        overdueTaskIds,
        requirementSummary: latestRequirements
          ? {
              version: latestRequirements.version,
              changesSummary: latestRequirements.changesSummary,
              excerpt: latestRequirements.content.slice(0, 1200),
              updatedAt: latestRequirements.createdAt,
            }
          : null,
        documentManifest: documents.map((document) => {
          const docSummary = existingData.documentSummaries?.[document.id] || null;
          return {
            id: document.id,
            originalName: document.originalName,
            mimeType: document.mimeType,
            size: document.size,
            createdAt: document.createdAt,
            summary: docSummary,
          };
        }),
        documentEmbeddings: existingData.documentEmbeddings || [],
        documentSummaries: existingData.documentSummaries || {},
        generatedAt: now,
      };

      await this.prisma.projectAiIndex.upsert({
        where: { projectId },
        create: {
          projectId,
          data: data as unknown as Prisma.InputJsonValue,
        },
        update: {
          data: data as unknown as Prisma.InputJsonValue,
        },
      });

      return data;
    } catch (error) {
      this.logger.warn(
        `Could not rebuild AI index for project ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  rebuildSoon(projectId: number) {
    // Clear existing timeout if any to debounce subsequent rebuild triggers (500ms)
    if (this.rebuildTimeouts.has(projectId)) {
      clearTimeout(this.rebuildTimeouts.get(projectId)!);
    }

    const timeout = setTimeout(() => {
      this.rebuildTimeouts.delete(projectId);
      void this.enqueueRebuild(projectId);
    }, 500);

    this.rebuildTimeouts.set(projectId, timeout);
  }

  private async enqueueRebuild(projectId: number): Promise<void> {
    // If a rebuild is already in progress for this project
    if (this.rebuildPromises.has(projectId)) {
      // If a next rebuild is already queued, do nothing as it will catch the latest state
      if (this.nextRebuildQueued.get(projectId)) {
        return;
      }

      this.nextRebuildQueued.set(projectId, true);

      try {
        // Wait for the current rebuild promise to resolve/reject
        await this.rebuildPromises.get(projectId);
      } catch {}

      this.nextRebuildQueued.delete(projectId);
      // Recursively run to handle the queued rebuild
      return this.enqueueRebuild(projectId);
    }

    // Start a new rebuild process
    const promise = this.rebuild(projectId);
    this.rebuildPromises.set(projectId, promise);

    try {
      await promise;
    } finally {
      this.rebuildPromises.delete(projectId);
    }
  }
}
