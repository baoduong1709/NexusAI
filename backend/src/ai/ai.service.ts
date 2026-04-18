import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  tasksCreated?: { id: number; title: string }[];
  suggestedTasks?: {
    title: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    dueDate?: string;
    sprint?: string;
    assigneeId?: number | null;
  }[];
}

export interface AiAnalysisResult {
  summary: string;
  suggestedTasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    suggestedRole?: string;
  }[];
  keyRequirements: string[];
  requirementsFile?: string; // path to generated .md file
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private tasksService: TasksService,
  ) {
    this.ai = new GoogleGenAI({
      apiKey: this.config.get("GEMINI_API_KEY", ""),
    });
  }

  async analyzeProject(projectId: number): Promise<AiAnalysisResult> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        documents: true,
        members: {
          include: {
            user: {
              select: {
                name: true,
                skills: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!project) throw new Error("Project not found");

    // Separate text files from binary files (PDF, DOCX, etc.)
    const TEXT_EXTS_ANALYZE = new Set([
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
    const docTextContents: string[] = [];
    const docInlineParts: { inlineData: { mimeType: string; data: string } }[] =
      [];

    for (const doc of project.documents) {
      const ext = path.extname(doc.originalName).toLowerCase();
      if (TEXT_EXTS_ANALYZE.has(ext)) {
        try {
          const text = fs.readFileSync(doc.path, "utf-8");
          docTextContents.push(`--- File: ${doc.originalName} ---\n${text}`);
        } catch {
          this.logger.warn(`Could not read file: ${doc.path}`);
        }
      } else {
        try {
          const buffer = fs.readFileSync(doc.path);
          docInlineParts.push({
            inlineData: {
              mimeType: doc.mimeType || "application/octet-stream",
              data: buffer.toString("base64"),
            },
          });
        } catch {
          this.logger.warn(`Could not read binary file: ${doc.path}`);
        }
      }
    }

    const teamInfo = project.members
      .map(
        (m: any) =>
          `${m.user.name} (${(m as any).projectRole || m.user.role?.name || "No role"}, skills: ${m.user.skills.join(", ")})`,
      )
      .join("\n");

    const systemPrompt = `You are an AI assistant for project management. 
    Analyze project requirements and suggest tasks with appropriate assignments.
    Always respond in valid JSON format.`;

    const userPrompt = `Project: "${project.name}"
Description: ${project.description || "N/A"}

Team Members:
${teamInfo || "No members assigned yet"}

${docInlineParts.length > 0 ? "Requirements Documents: See attached files above.\n" : ""}${docTextContents.length > 0 ? `Requirements Documents:\n${docTextContents.join("\n\n")}` : docInlineParts.length === 0 ? "Requirements Documents: No documents uploaded" : ""}

Please analyze the above and respond with a JSON object in this exact format:
{
  "summary": "Brief 2-3 sentence summary of the project requirements",
  "keyRequirements": ["requirement 1", "requirement 2", "..."],
  "suggestedTasks": [
    {
      "title": "Task title",
      "description": "Detailed task description",
      "priority": "HIGH|MEDIUM|LOW",
      "suggestedRole": "Developer|Designer|Tester|PM|Lead"
    }
  ]
}`;

    try {
      const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
      let responseText = "";

      const stream = await this.ai.models.generateContentStream({
        model,
        config: { temperature: 0.3 },
        contents: [
          {
            role: "user",
            parts: [
              ...docInlineParts,
              { text: `${systemPrompt}\n\n${userPrompt}` },
            ],
          },
        ],
      });

      for await (const chunk of stream) {
        if (chunk.text) responseText += chunk.text;
      }

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");

      const result = JSON.parse(jsonMatch[0]) as AiAnalysisResult;

      // Generate requirements markdown file
      try {
        const mdContent = this.buildRequirementsMarkdown(project, result);
        const uploadDir = this.config.get("UPLOAD_DIR", "./uploads");
        const mdDir = path.join(uploadDir, `project-${projectId}`);
        if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });
        const mdPath = path.join(mdDir, "requirements.md");
        fs.writeFileSync(mdPath, mdContent, "utf-8");
        result.requirementsFile = mdPath;

        // Upsert as a Document record
        const existing = await this.prisma.document.findFirst({
          where: { projectId, originalName: "requirements.md" },
        });
        if (existing) {
          await this.prisma.document.update({
            where: { id: existing.id },
            data: { path: mdPath, size: Buffer.byteLength(mdContent) },
          });
        } else {
          await this.prisma.document.create({
            data: {
              projectId,
              originalName: "requirements.md",
              filename: `requirements-${projectId}.md`,
              path: mdPath,
              mimeType: "text/markdown",
              size: Buffer.byteLength(mdContent),
            },
          });
        }
      } catch (e) {
        this.logger.warn("Could not save requirements.md", e);
      }

      return result;
    } catch (error) {
      this.logger.error("AI analysis failed", error);
      throw new Error(`AI analysis failed: ${(error as Error).message}`);
    }
  }

  async confirmAndCreateTasks(projectId: number, tasks: any[]) {
    return this.tasksService.bulkCreate(
      projectId,
      tasks.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority || "MEDIUM",
        assigneeId: t.assigneeId || undefined,
        dueDate: t.dueDate || undefined,
        sprint: t.sprint || undefined,
        isAiGenerated: true,
      })),
    );
  }

  async suggestAssignees(projectId: number, taskDescription: string) {
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

    if (!members.length) return [];

    const teamInfo = members
      .map(
        (m: any) =>
          `ID:${m.user.id} - ${m.user.name} (${(m as any).projectRole || m.user.role?.name || "No role"}, skills: ${m.user.skills.join(", ")})`,
      )
      .join("\n");

    const prompt = `Given this task: "${taskDescription}"
    
And these team members:
${teamInfo}

Return a JSON array of up to 3 best-suited member IDs in order of suitability:
{ "suggestions": [{ "userId": 1, "reason": "..." }] }`;

    try {
      const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
      let text = "";

      const stream = await this.ai.models.generateContentStream({
        model,
        config: { temperature: 0.2 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      for await (const chunk of stream) {
        if (chunk.text) text += chunk.text;
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]).suggestions || [];
    } catch {
      return [];
    }
  }

  // ─── Init empty requirements when project is created ──────────────────────

  async initRequirements(
    projectId: number,
    projectName: string,
    description?: string,
  ): Promise<void> {
    const content = [
      `# Tài liệu Yêu cầu Dự án: ${projectName}`,
      ``,
      `> Tạo lúc: ${new Date().toLocaleDateString("vi-VN")} · Chưa phân tích AI`,
      ``,
      `## Mô tả`,
      ``,
      description || "_Chưa có mô tả_",
      ``,
      `## Yêu cầu chính`,
      ``,
      `_Chưa có yêu cầu nào. Upload tài liệu và nhấn "Cập nhật Requirements" để AI phân tích._`,
      ``,
      `## Danh sách Task đề xuất`,
      ``,
      `_Chưa có task đề xuất._`,
    ].join("\n");

    await this.saveRequirementsFile(projectId, content);
    await this.prisma.requirementsHistory.create({
      data: { projectId, version: 1, content },
    });
  }

  // ─── Update requirements from documents + AI ───────────────────────────────

  async updateRequirements(
    projectId: number,
  ): Promise<{ content: string; version: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        documents: true,
        members: {
          include: {
            user: {
              select: {
                name: true,
                skills: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!project) throw new Error("Project not found");

    // Separate text files from binary files (PDF, DOCX, etc.)
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
    const textDocContents: string[] = [];
    const inlineFileParts: {
      inlineData: { mimeType: string; data: string };
    }[] = [];

    for (const doc of project.documents) {
      if (doc.originalName === "requirements.md") continue;
      const ext = path.extname(doc.originalName).toLowerCase();
      if (TEXT_EXTS.has(ext)) {
        try {
          const text = fs.readFileSync(doc.path, "utf-8");
          textDocContents.push(`--- ${doc.originalName} ---\n${text}`);
        } catch {
          /* skip unreadable */
        }
      } else {
        // Binary files: send as base64 inlineData so Gemini can parse them natively
        try {
          const buffer = fs.readFileSync(doc.path);
          inlineFileParts.push({
            inlineData: {
              mimeType: doc.mimeType || "application/octet-stream",
              data: buffer.toString("base64"),
            },
          });
          this.logger.log(`Sending binary file inline: ${doc.originalName}`);
        } catch {
          this.logger.warn(`Could not read binary file: ${doc.path}`);
        }
      }
    }

    const teamInfo = project.members
      .map(
        (m: any) =>
          `- ${m.user.name} (${(m as any).projectRole || m.user.role?.name || "No role"}, skills: ${m.user.skills.join(", ")})`,
      )
      .join("\n");

    const docNote =
      inlineFileParts.length > 0
        ? "Xem các file tài liệu đính kèm bên trên."
        : textDocContents.length > 0
          ? ""
          : "Chưa có tài liệu.";

    const prompt = `Bạn là AI phân tích yêu cầu dự án. Hãy tạo file requirements.md cho dự án sau.

Dự án: "${project.name}"
Mô tả: ${project.description || "N/A"}

Thành viên:
${teamInfo || "Chưa có"}

${textDocContents.length > 0 ? `Tài liệu văn bản:\n${textDocContents.join("\n\n")}\n` : ""}${docNote}

Tạo file requirements.md bằng tiếng Việt với các mục:
# Tài liệu Yêu cầu Dự án: <tên>
## Tóm tắt
## Yêu cầu chức năng
## Yêu cầu phi chức năng
## Phạm vi dự án
## Danh sách Task đề xuất (dạng bảng markdown)`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    let content = "";
    const stream = await this.ai.models.generateContentStream({
      model,
      config: { temperature: 0.3 },
      contents: [
        {
          role: "user",
          parts: [...inlineFileParts, { text: prompt }],
        },
      ],
    });
    for await (const chunk of stream) {
      if (chunk.text) content += chunk.text;
    }

    // Strip possible ```markdown fences
    content = content
      .replace(/^```(?:markdown)?\n?/i, "")
      .replace(/\n?```\s*$/, "")
      .trim();

    // Save history: get latest version
    const latest = await this.prisma.requirementsHistory.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;

    // Generate AI change summary compared to previous version
    let changesSummary: string | null = null;
    if (latest?.content) {
      try {
        const diffPrompt = `So sánh 2 phiên bản requirements sau và tóm tắt những thay đổi chính bằng 3-5 gạch đầu dòng ngắn gọn bằng tiếng Việt. CHỈ liệt kê thay đổi, KHÔNG giải thích dài dòng.

=== PHIÊN BẢN CŨ (v${latest.version}) ===
${latest.content.slice(0, 3000)}

=== PHIÊN BẢN MỚI (v${version}) ===
${content.slice(0, 3000)}

Trả về danh sách các thay đổi (mỗi dòng bắt đầu bằng "- "):`;

        const diffModel = this.config.get("AI_MODEL", "gemma-4-31b-it");
        let diffText = "";
        const diffStream = await this.ai.models.generateContentStream({
          model: diffModel,
          config: { temperature: 0.2 },
          contents: [{ role: "user", parts: [{ text: diffPrompt }] }],
        });
        for await (const chunk of diffStream) {
          if (chunk.text) diffText += chunk.text;
        }
        changesSummary = diffText
          .replace(/^```[\s\S]*?\n/, "")
          .replace(/\n?```\s*$/, "")
          .trim()
          .slice(0, 1000);
      } catch {
        this.logger.warn("Could not generate changes summary");
      }
    }

    await this.prisma.requirementsHistory.create({
      data: { projectId, version, content, changesSummary },
    });
    await this.saveRequirementsFile(projectId, content);

    return { content, version };
  }

  async getRequirementsContent(
    projectId: number,
  ): Promise<{ content: string; version: number } | null> {
    const latest = await this.prisma.requirementsHistory.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    return latest ? { content: latest.content, version: latest.version } : null;
  }

  async getRequirementsHistory(projectId: number) {
    return this.prisma.requirementsHistory.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        createdAt: true,
        changesSummary: true,
      },
    });
  }

  async getRequirementsVersion(historyId: number): Promise<{
    id: number;
    version: number;
    content: string;
    changesSummary: string | null;
    createdAt: Date;
  } | null> {
    return this.prisma.requirementsHistory.findUnique({
      where: { id: historyId },
      select: {
        id: true,
        version: true,
        content: true,
        changesSummary: true,
        createdAt: true,
      },
    });
  }

  private async saveRequirementsFile(projectId: number, content: string) {
    const uploadDir = this.config.get("UPLOAD_DIR", "./uploads");
    const dir = path.join(uploadDir, `project-${projectId}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "requirements.md");
    fs.writeFileSync(filePath, content, "utf-8");

    const existing = await this.prisma.document.findFirst({
      where: { projectId, originalName: "requirements.md" },
    });
    if (existing) {
      await this.prisma.document.update({
        where: { id: existing.id },
        data: { path: filePath, size: Buffer.byteLength(content) },
      });
    } else {
      await this.prisma.document.create({
        data: {
          projectId,
          originalName: "requirements.md",
          filename: `requirements-${projectId}.md`,
          path: filePath,
          mimeType: "text/markdown",
          size: Buffer.byteLength(content),
        },
      });
    }
  }

  // ─── Chat with AI to create tasks via natural language ─────────────────────

  async chat(
    projectId: number,
    messages: ChatMessage[],
  ): Promise<ChatResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { select: { id: true, title: true, status: true } },
        members: {
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
        },
      },
    });
    if (!project) throw new Error("Project not found");

    // Load requirements from DB
    let requirementsContent = "";
    const latestReq = await this.prisma.requirementsHistory.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    if (latestReq) requirementsContent = latestReq.content;

    const teamInfo = project.members
      .map(
        (m: any) =>
          `ID:${m.user.id} - ${m.user.name} (${(m as any).projectRole || m.user.role?.name || "No role"}, skills: ${m.user.skills.join(", ")})`,
      )
      .join("\n");

    const existingTasks = project.tasks
      .map((t) => `- [${t.status}] ${t.title}`)
      .join("\n");

    const systemPrompt = `Bạn là AI assistant quản lý dự án "${project.name}". 
Bạn có thể trả lời câu hỏi và ĐỀ XUẤT TASK khi người dùng yêu cầu.

Thành viên dự án:
${teamInfo || "Chưa có thành viên"}

Tasks hiện tại:
${existingTasks || "Chưa có task nào"}

${requirementsContent ? `Tài liệu yêu cầu:\n${requirementsContent}` : ""}

Khi người dùng yêu cầu tạo task (ví dụ: "tạo task cho module X", "tạo task cho tính năng Y"), 
hãy ĐỀ XUẤT task (chưa tạo ngay) và phản hồi JSON theo định dạng sau (KHÔNG bọc trong markdown code block):
{
  "message": "Đề xuất X task cho...",
  "createTasks": [
    {
      "title": "Tên task",
      "description": "Mô tả chi tiết",
      "priority": "HIGH|MEDIUM|LOW",
      "dueDate": "YYYY-MM-DD hoặc null",
      "sprint": "Sprint 1 hoặc null",
      "assigneeId": <userId hoặc null>
    }
  ]
}

Nếu chỉ trả lời câu hỏi (không đề xuất task), phản hồi JSON:
{
  "message": "Nội dung câu trả lời"
}`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      {
        role: "model" as const,
        parts: [
          {
            text: '{"message": "Xin chào! Tôi sẵn sàng hỗ trợ bạn quản lý dự án. Bạn có thể hỏi tôi về dự án hoặc yêu cầu tạo task."}',
          },
        ],
      },
      ...messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      })),
    ];

    let rawText = "";
    const stream = await this.ai.models.generateContentStream({
      model,
      config: { temperature: 0.4 },
      contents,
    });
    for await (const chunk of stream) {
      if (chunk.text) rawText += chunk.text;
    }

    // Parse response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { message: rawText.trim() };

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { message: rawText.trim() };
    }

    // Return suggested tasks for user review — do NOT create yet
    if (parsed.createTasks?.length) {
      return {
        message:
          parsed.message ||
          `AI đề xuất ${parsed.createTasks.length} task. Hãy review và chỉnh sửa trước khi tạo.`,
        suggestedTasks: parsed.createTasks.map((t: any) => ({
          title: t.title,
          description: t.description || "",
          priority: t.priority || "MEDIUM",
          dueDate: t.dueDate && t.dueDate !== "null" ? t.dueDate : undefined,
          sprint: t.sprint && t.sprint !== "null" ? t.sprint : undefined,
          assigneeId: t.assigneeId || null,
        })),
      };
    }

    return { message: parsed.message || rawText.trim() };
  }

  // ─── Helper: build requirements markdown ───────────────────────────────────

  private buildRequirementsMarkdown(
    project: any,
    analysis: AiAnalysisResult,
  ): string {
    const now = new Date().toLocaleDateString("vi-VN");
    const lines: string[] = [
      `# Tài liệu Yêu cầu Dự án: ${project.name}`,
      ``,
      `> Được tạo tự động bởi NexusAI · ${now}`,
      ``,
      `## Tóm tắt`,
      ``,
      analysis.summary,
      ``,
      `## Yêu cầu chính`,
      ``,
      ...(analysis.keyRequirements || []).map((r, i) => `${i + 1}. ${r}`),
      ``,
      `## Danh sách Task đề xuất`,
      ``,
      `| # | Task | Mô tả | Ưu tiên | Role |`,
      `|---|------|-------|---------|------|`,
      ...(analysis.suggestedTasks || []).map(
        (t, i) =>
          `| ${i + 1} | ${t.title} | ${(t.description || "").replace(/\n/g, " ")} | ${t.priority} | ${t.suggestedRole || "—"} |`,
      ),
      ``,
      `## Thông tin dự án`,
      ``,
      `- **Tên dự án:** ${project.name}`,
      `- **Mô tả:** ${project.description || "N/A"}`,
      `- **Ngày bắt đầu:** ${project.startDate ? new Date(project.startDate).toLocaleDateString("vi-VN") : "N/A"}`,
      `- **Ngày kết thúc:** ${project.endDate ? new Date(project.endDate).toLocaleDateString("vi-VN") : "N/A"}`,
    ];
    return lines.join("\n");
  }
}
