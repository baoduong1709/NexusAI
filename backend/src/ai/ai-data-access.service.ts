import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  getProjectRolePermissions,
  normalizeProjectRoleConfigs,
} from "../projects/project-roles";
import * as fs from "fs";
import * as path from "path";

/**
 * Dữ liệu dự án đã được lọc theo quyền của user.
 * AI chỉ nhận được thông tin mà user thực sự có quyền xem.
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
  /** Chỉ có khi user có quyền project:read */
  members?: {
    userId: number;
    name: string;
    projectRole: string | null;
    skills: string[];
    globalRole: string | null;
  }[];
  /** Chỉ có khi user có quyền task:read */
  tasks?: {
    id: number;
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
  /** Chỉ có khi user có quyền project:read */
  documents?: {
    id: number;
    originalName: string;
    mimeType: string | null;
    size: number;
  }[];
  /** Nội dung tài liệu — chỉ có khi user có quyền project:read */
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
  /** Chỉ có khi user có quyền ai:analyze */
  requirementsContent?: string;
  /** Danh sách quyền thực tế của user trong project */
  userPermissions: string[];
  /** Role của user trong project */
  userProjectRole: string | null;
}

@Injectable()
export class AiDataAccessService {
  private readonly logger = new Logger(AiDataAccessService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Resolve permissions của user trong project.
   * Merge global permissions (từ system role) + project-scoped permissions (từ project role).
   */
  async resolveUserPermissions(
    projectId: number,
    userId: number,
  ): Promise<{ permissions: string[]; projectRole: string | null }> {
    // 1. Lấy global permissions từ system role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: { select: { permissions: true } },
      },
    });

    const globalPermissions: string[] = Array.isArray(user?.role?.permissions)
      ? (user.role.permissions as string[])
      : [];

    // 2. Lấy project-scoped permissions từ project role
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
   * Lấy dữ liệu dự án đã lọc theo quyền user.
   * Đây là method chính mà AiService sẽ gọi thay vì query trực tiếp DB.
   */
  async getFilteredProjectContext(
    projectId: number,
    userId: number,
  ): Promise<FilteredProjectContext> {
    const { permissions, projectRole } = await this.resolveUserPermissions(
      projectId,
      userId,
    );

    const has = (perm: string) => permissions.includes(perm);

    // Luôn lấy thông tin cơ bản của project (user đã qua guard rồi)
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

    // Members — cần project:read
    if (has("project:read")) {
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

    // Tasks — cần task:read
    if (has("task:read")) {
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

    // Documents — cần project:read
    if (has("project:read")) {
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

    // Requirements — cần ai:analyze
    if (has("ai:analyze")) {
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
   * Lấy nội dung documents (text + binary) — chỉ khi user có quyền project:read.
   * Dùng cho analyze và updateRequirements.
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
    const inlineParts: { inlineData: { mimeType: string; data: string } }[] =
      [];
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
