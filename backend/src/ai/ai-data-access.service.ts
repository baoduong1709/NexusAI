import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  getProjectRolePermissions,
  normalizeProjectRoleConfigs,
} from "../projects/project-roles";
import * as fs from "fs";
import * as path from "path";

/**
 * Project data filtered according to user permissions.
 * AI only receives information that the user actually has permission to view.
 */
export interface FilteredProjectContext {
  project: {
    id: number;
    name: string;
    description: string | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    taskStatuses: string[];
    epics: string[];
    labels: string[];
    taskNamingRule: string | null;
  };
  /** Only available when the user has project:read permission */
  members?: {
    userId: number;
    name: string;
    projectRole: string | null;
    skills: string[];
    globalRole: string | null;
  }[];
  /** Only available when the user has task:read permission */
  tasks?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    epic: string | null;
    labels: string[];
    sprint: string | null;
    assigneeId: number | null;
    assigneeName: string | null;
    dueDate: Date | null;
    estimateHours: number;
    loggedHours: number;
    description: string | null;
  }[];
  /** Only available when the user has project:read permission */
  documents?: {
    id: number;
    originalName: string;
    mimeType: string | null;
    size: number;
  }[];
  /** Document contents — only available when the user has project:read permission */
  documentContents?: {
    textDocs: string[];
    inlineParts: { inlineData: { mimeType: string; data: string } }[];
    sources: {
      id: number;
      originalName: string;
      mimeType: string | null;
      size: number;
      kind: "text" | "binary";
    }[];
  };
  /** Only available when the user has ai:analyze permission */
  requirementsContent?: string;
  /** Actual user permissions in the project */
  userPermissions: string[];
  /** User role in the project */
  userProjectRole: string | null;
}

export interface ProjectContextOptions {
  includeMembers?: boolean;
  includeTasks?: boolean;
  includeDocuments?: boolean;
  includeRequirements?: boolean;
}

@Injectable()
export class AiDataAccessService {
  private readonly logger = new Logger(AiDataAccessService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Resolves the user's permissions in the project.
   * Merges global permissions (from system role) + project-scoped permissions (from project role).
   */
  async resolveUserPermissions(
    projectId: number,
    userId: number,
  ): Promise<{ permissions: string[]; projectRole: string | null }> {
    // 1. Get global permissions from system role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: { select: { permissions: true } },
      },
    });

    const globalPermissions: string[] = Array.isArray(user?.role?.permissions)
      ? (user.role.permissions as string[])
      : [];

    // 2. Get project-scoped permissions from project role
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: {
        projectRole: true,
        project: {
          select: {
            projectRoles: true,
            projectRoleConfigs: true,
          },
        },
      },
    });

    let projectPermissions: string[] = [];
    const projectRole = membership?.projectRole ?? null;

    if (membership?.projectRole) {
      const roleConfigs = normalizeProjectRoleConfigs(
        membership.project.projectRoleConfigs,
        membership.project.projectRoles,
      );
      projectPermissions = getProjectRolePermissions(
        roleConfigs,
        membership.projectRole,
      );
    }

    // 3. Merge & deduplicate
    const merged = Array.from(
      new Set([...globalPermissions, ...projectPermissions]),
    );

    return { permissions: merged, projectRole };
  }

  /**
   * Retrieves project context filtered by user permissions.
   */
  async getFilteredProjectContext(
    projectId: number,
    userId: number,
    options: ProjectContextOptions = {
      includeMembers: true,
      includeTasks: true,
      includeDocuments: true,
      includeRequirements: true,
    },
  ): Promise<FilteredProjectContext> {
    const { permissions, projectRole } = await this.resolveUserPermissions(
      projectId,
      userId,
    );

    const has = (perm: string) => permissions.includes(perm);

    // Always fetch basic project details
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        taskStatuses: true,
        epics: true,
        labels: true,
        taskNamingRule: true,
      },
    });

    if (!project) throw new NotFoundException("Project not found");

    const result: FilteredProjectContext = {
      project,
      userPermissions: permissions,
      userProjectRole: projectRole,
    };

    // Members — requires project:read
    if (options.includeMembers && has("project:read")) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              skills: true,
              role: { select: { name: true } },
            },
          },
        },
      });

      result.members = members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        projectRole: m.projectRole,
        skills: m.user.skills,
        globalRole: m.user.role?.name ?? null,
      }));
    }

    // Tasks — requires task:read
    if (options.includeTasks && has("task:read")) {
      const tasks = await this.prisma.task.findMany({
        where: { projectId },
        include: {
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      result.tasks = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        epic: t.epic,
        labels: t.labels,
        sprint: t.sprint,
        assigneeId: t.assignee?.id ?? null,
        assigneeName: t.assignee?.name ?? null,
        dueDate: t.dueDate,
        estimateHours: t.estimateHours,
        loggedHours: t.loggedHours,
        description: t.description,
      }));
    }

    // Documents — requires project:read
    if (options.includeDocuments && has("project:read")) {
      const documents = await this.prisma.document.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });

      result.documents = documents.map((d) => ({
        id: d.id,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
      }));
    }

    // Requirements — requires ai:analyze
    if (options.includeRequirements && has("ai:analyze")) {
      const latestReq = await this.prisma.requirementsHistory.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
      });
      if (latestReq) {
        result.requirementsContent = latestReq.content;
      }
    }

    return result;
  }

  /**
   * Retrieves document contents (text & binary files converted to text) — only when user has project:read.
   */
  async getFilteredDocumentContents(
    projectId: number,
    userId: number,
  ): Promise<{
    textDocs: string[];
    inlineParts: { inlineData: { mimeType: string; data: string } }[];
    sources: {
      id: number;
      originalName: string;
      mimeType: string | null;
      size: number;
      kind: "text" | "binary";
    }[];
  }> {
    const { permissions } = await this.resolveUserPermissions(
      projectId,
      userId,
    );

    if (!permissions.includes("project:read")) {
      return { textDocs: [], inlineParts: [], sources: [] };
    }

    const documents = await this.prisma.document.findMany({
      where: { projectId },
    });

    const TEXT_EXTS = new Set([
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".xml",
      ".html",
      ".htm",
      ".yaml",
      ".yml",
      ".log",
    ]);

    const textDocs: string[] = [];
    const inlineParts: { inlineData: { mimeType: string; data: string } }[] = [];
    const sources: {
      id: number;
      originalName: string;
      mimeType: string | null;
      size: number;
      kind: "text" | "binary";
    }[] = [];

    for (const doc of documents) {
      if (doc.originalName === "requirements.md") continue;
      const ext = path.extname(doc.originalName).toLowerCase();

      if (TEXT_EXTS.has(ext)) {
        try {
          const text = fs.readFileSync(doc.path, "utf-8");
          textDocs.push(`--- ${doc.originalName} ---\n${text}`);
          sources.push({
            id: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            size: doc.size,
            kind: "text",
          });
        } catch {
          this.logger.warn(`Could not read file: ${doc.path}`);
        }
      } else {
        // Check if there is a converted markdown version available
        const mdPath = `${doc.path}.md`;
        if (fs.existsSync(mdPath)) {
          try {
            const markdownText = fs.readFileSync(mdPath, "utf-8");
            textDocs.push(`--- [Converted to Markdown] ${doc.originalName} ---\n${markdownText}`);
            sources.push({
              id: doc.id,
              originalName: doc.originalName,
              mimeType: "text/markdown",
              size: Buffer.byteLength(markdownText),
              kind: "text",
            });
            continue; // Skip the binary fallback
          } catch {
            this.logger.warn(`Could not read converted markdown file: ${mdPath}`);
          }
        }

        // Fallback to binary multimodal processing if markdown is not available
        try {
          const buffer = fs.readFileSync(doc.path);
          inlineParts.push({
            inlineData: {
              mimeType: doc.mimeType || "application/octet-stream",
              data: buffer.toString("base64"),
            },
          });
          sources.push({
            id: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            size: doc.size,
            kind: "binary",
          });
        } catch {
          this.logger.warn(`Could not read binary file: ${doc.path}`);
        }
      }
    }

    return { textDocs, inlineParts, sources };
  }
}
