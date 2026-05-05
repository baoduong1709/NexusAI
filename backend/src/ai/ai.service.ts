import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadGatewayException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { AiDataAccessService, FilteredProjectContext } from "./ai-data-access.service";
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
    epic?: string;
    labels?: string[];
    sprint?: string;
    assigneeId?: number | null;
    estimateHours?: number;
    loggedHours?: number;
  }[];
}

export interface AiAnalysisResult {
  summary: string;
  suggestedTasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    epic?: string;
    labels?: string[];
    suggestedRole?: string;
  }[];
  keyRequirements: string[];
  requirementsFile?: string; // path to generated .md file
}

function formatRequirementTimestamp(date = new Date()) {
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private tasksService: TasksService,
    private dataAccess: AiDataAccessService,
  ) {
    this.ai = new GoogleGenAI({
      apiKey: this.config.get("GEMINI_API_KEY", ""),
    });
  }

  private getAiErrorStatus(error: any): number | undefined {
    return error?.status || error?.code || error?.response?.status;
  }

  private isRetryableAiError(error: any) {
    const status = this.getAiErrorStatus(error);
    return status === 429 || (typeof status === "number" && status >= 500);
  }

  private getAiErrorMessage(error: any) {
    const raw = error?.message || String(error);
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.message || raw;
    } catch {
      return raw;
    }
  }

  private async generateAiText(
    options: Parameters<GoogleGenAI["models"]["generateContentStream"]>[0],
    context: string,
  ) {
    let lastError: any;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        let text = "";
        const stream = await this.ai.models.generateContentStream(options);
        for await (const chunk of stream) {
          if (chunk.text) text += chunk.text;
        }
        return text;
      } catch (error: any) {
        lastError = error;
        const status = this.getAiErrorStatus(error);
        const message = this.getAiErrorMessage(error);
        this.logger.warn(
          `AI ${context} failed on attempt ${attempt}/3: ${status || "unknown"} ${message}`,
        );

        if (attempt === 3 || !this.isRetryableAiError(error)) break;
        await sleep(500 * attempt);
      }
    }

    throw new BadGatewayException({
      message:
        "AI provider temporarily failed. Please try again in a moment.",
      detail: this.getAiErrorMessage(lastError),
      status: this.getAiErrorStatus(lastError),
    });
  }

  async analyzeProject(
    projectId: number,
    userId: number,
  ): Promise<AiAnalysisResult> {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );
    const docContents = await this.dataAccess.getFilteredDocumentContents(
      projectId,
      userId,
    );
    const sourceManifest = this.buildSourceManifest(docContents.sources);

    const teamInfo = ctx.members
      ? ctx.members
          .map(
            (m) =>
              `${m.name} (${m.projectRole || m.globalRole || "No role"}, skills: ${m.skills.join(", ")})`,
          )
          .join("\n")
      : "Bạn không có quyền xem thành viên dự án";

    const systemPrompt = `You are an AI assistant for project management. 
    Analyze project requirements and suggest tasks with appropriate assignments.
    Always respond in valid JSON format.`;

const userPrompt = `Project: "${ctx.project.name}"
Description: ${ctx.project.description || "N/A"}
Available epics: ${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: ${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}
Task naming rule: ${ctx.project.taskNamingRule || "None"}

Team Members:
${teamInfo || "No members assigned yet"}

Requirements baseline:
${ctx.requirementsContent || "No consolidated requirements.md exists yet. Use uploaded documents as the source of truth."}

Uploaded source files available for detail lookup:
${sourceManifest || "No uploaded source files."}

${docContents.inlineParts.length > 0 ? "Detailed source files: attached binary files are included above. Use them only to clarify the consolidated requirements or fill missing detail.\n" : ""}${docContents.textDocs.length > 0 ? `Detailed source text files:\n${docContents.textDocs.join("\n\n")}` : docContents.inlineParts.length === 0 ? "Detailed source files: No documents uploaded" : ""}

Please analyze the above and respond with a JSON object in this exact format:
{
  "summary": "Brief 2-3 sentence summary of the project requirements",
  "keyRequirements": ["requirement 1", "requirement 2", "..."],
  "suggestedTasks": [
    {
      "title": "Task title",
      "description": "Detailed task description. Include Acceptance Criteria and Source refs from requirements.md plus source files.",
      "priority": "HIGH|MEDIUM|LOW",
      "epic": "One of the available epics or null",
      "labels": ["Only labels from the available labels list"],
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
              ...docContents.inlineParts,
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
        const mdContent = this.buildRequirementsMarkdown(ctx, result);
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
        epic: t.epic || undefined,
        labels: Array.isArray(t.labels) ? t.labels : undefined,
        sprint: t.sprint || undefined,
        estimateHours: t.estimateHours ?? undefined,
        loggedHours: t.loggedHours ?? undefined,
        isAiGenerated: true,
      })),
    );
  }

  async suggestAssignees(
    projectId: number,
    taskDescription: string,
    userId: number,
  ) {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );

    if (!ctx.members?.length) return [];

    const teamInfo = ctx.members
      .map(
        (m) =>
          `ID:${m.userId} - ${m.name} (${m.projectRole || m.globalRole || "No role"}, skills: ${m.skills.join(", ")})`,
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

  async improveTaskDescription(
    projectId: number,
    userId: number,
    description: string,
    title?: string,
  ): Promise<{ description: string }> {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );

    const prompt = `You are an assistant that improves task descriptions for software projects.
Return only HTML (no markdown, no code fences).

Project: ${ctx.project.name}
Task title: ${title || "Untitled task"}

Current description:
${description}

Rules:
- Keep the same intent and scope from current description.
- Make it clearer and actionable for engineers and QA.
- Structure the output using short sections in this order when possible:
  1) Objective
  2) Scope
  3) Acceptance Criteria (as <ul><li>)
  4) Notes / Risks
- Keep it concise.
- Do not invent product facts not present in the description.
- Output valid HTML snippet using only tags: p, strong, em, ul, ol, li, br, code.`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    const improved = await this.generateAiText(
      {
        model,
        config: { temperature: 0.2 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
      "description improve",
    );

    return { description: improved.trim() };
  }

  async assistTaskDescription(
    projectId: number,
    userId: number,
    description: string,
    instruction: string,
    title?: string,
  ): Promise<{ description: string; message: string }> {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );

    const prompt = `You are an assistant for editing software task descriptions.
Return strict JSON, no markdown:
{
  "message": "short response in Vietnamese",
  "description": "updated HTML snippet"
}

Project: ${ctx.project.name}
Task title: ${title || "Untitled task"}

Current description (HTML allowed):
${description}

User instruction:
${instruction}

Rules:
- Follow user instruction exactly.
- Keep facts grounded in current description.
- Output description as valid HTML snippet using only: p, strong, em, ul, ol, li, br, code.
- Keep it concise and actionable for engineering and QA.`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    const raw = await this.generateAiText(
      {
        model,
        config: { temperature: 0.2 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
      "description assist",
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        message: "Da cap nhat description theo yeu cau.",
        description: raw.trim(),
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message:
          String(parsed.message || "").trim() ||
          "Da cap nhat description theo yeu cau.",
        description: String(parsed.description || "").trim() || description,
      };
    } catch {
      return {
        message: "Da cap nhat description theo yeu cau.",
        description: raw.trim() || description,
      };
    }
  }

  // ─── Init empty requirements when project is created ──────────────────────

  async initRequirements(
    projectId: number,
    projectName: string,
    description?: string,
  ): Promise<void> {
    const now = formatRequirementTimestamp();
    const content = [
      `# Tài liệu Yêu cầu Dự án: ${projectName}`,
      ``,
      `> Tao luc: ${now} - Chua phan tich AI`,
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
    userId: number,
  ): Promise<{ content: string; version: number }> {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );
    const docContents = await this.dataAccess.getFilteredDocumentContents(
      projectId,
      userId,
    );

    const teamInfo = ctx.members
      ? ctx.members
          .map(
            (m) =>
              `- ${m.name} (${m.projectRole || m.globalRole || "No role"}, skills: ${m.skills.join(", ")})`,
          )
          .join("\n")
      : "Chưa có";

    const latest = await this.prisma.requirementsHistory.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const updatedAt = formatRequirementTimestamp();
    const sourceManifest = this.buildSourceManifest(docContents.sources);
    const previousRequirements =
      latest?.content ||
      ctx.requirementsContent ||
      "No previous consolidated requirements.";

    const prompt = `You are NexusAI's requirements curator.
Your job is to update the consolidated requirements.md for a complex software project.

Project: "${ctx.project.name}"
Description: ${ctx.project.description || "N/A"}
Available epics: ${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: ${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}
Task naming rule: ${ctx.project.taskNamingRule || "None"}

Team:
${teamInfo || "No members"}

Current consolidated requirements.md:
${previousRequirements}

Uploaded source files for this update:
${sourceManifest || "No uploaded source files."}

${docContents.inlineParts.length > 0 ? "Binary/source documents are attached above. Read them for detail.\n" : ""}${docContents.textDocs.length > 0 ? `Text source documents:\n${docContents.textDocs.join("\n\n")}\n` : ""}

Update rules:
- Return the FULL updated requirements.md content, not a diff.
- Preserve existing requirements that are still valid.
- Merge new information from uploaded source files into the right sections.
- Do not force a rigid format if the source documents are complex; keep domain-specific sections when needed.
- Do not rewrite unrelated sections just for style.
- If a new file conflicts with existing requirements, keep both facts and add a clear "## Conflicts / Needs PM Review" section.
- Add source references inline where practical, using this format: [source: filename].
- Maintain a "## Change Log" section at the bottom with a short entry for v${version} at ${updatedAt}.
- The top metadata block must include: Cap nhat lan cuoi: ${updatedAt} - v${version}.
- Output in Vietnamese. Do not wrap the answer in markdown code fences.

Suggested baseline sections when no better domain-specific structure exists:
# Tai lieu Yeu cau Du an: <project name>
## Tong quan
## Pham vi
## Yeu cau chuc nang
## Yeu cau phi chuc nang
## Business rules
## Acceptance criteria
## Open questions
## Conflicts / Needs PM Review
## Change Log`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    let content = await this.generateAiText({
      model,
      config: { temperature: 0.3 },
      contents: [
        {
          role: "user",
          parts: [...docContents.inlineParts, { text: prompt }],
        },
      ],
    }, "requirements update");

    // Strip possible ```markdown fences
    content = content
      .replace(/^```(?:markdown)?\n?/i, "")
      .replace(/\n?```\s*$/, "")
      .trim();

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
        const diffText = await this.generateAiText({
          model: diffModel,
          config: { temperature: 0.2 },
          contents: [{ role: "user", parts: [{ text: diffPrompt }] }],
        }, "requirements diff summary");
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
  ): Promise<{ content: string; version: number; createdAt: Date } | null> {
    const latest = await this.prisma.requirementsHistory.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    return latest
      ? {
          content: latest.content,
          version: latest.version,
          createdAt: latest.createdAt,
        }
      : null;
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

  // ─── Chat with AI — data filtered by user permissions ──────────────────────

  async chat(
    projectId: number,
    userId: number,
    messages: ChatMessage[],
    summary?: string,
  ): Promise<ChatResponse> {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );
    const docContents = await this.dataAccess.getFilteredDocumentContents(
      projectId,
      userId,
    );
    const sourceManifest = this.buildSourceManifest(docContents.sources);

    // Build context sections based on what user can see
    const teamInfo = ctx.members
      ? ctx.members
          .map(
            (m) =>
              `ID:${m.userId} - ${m.name} (${m.projectRole || m.globalRole || "No role"}, skills: ${m.skills.join(", ")})`,
          )
          .join("\n")
      : "";

    const existingTasks = ctx.tasks
      ? ctx.tasks
          .map(
            (t) =>
              `- [${t.status}] ${t.title} (epic: ${t.epic || "none"}, labels: ${t.labels.length ? t.labels.join(", ") : "none"}, sprint: ${t.sprint || "none"}, est: ${t.estimateHours}h, logged: ${t.loggedHours}h)`,
          )
          .join("\n")
      : "";

    // Build permission-aware hints for AI
    const permissionHints = this.buildPermissionHints(ctx);

    const systemPrompt = `Bạn là AI assistant quản lý dự án "${ctx.project.name}". 
Bạn có thể trả lời câu hỏi và ĐỀ XUẤT TASK khi người dùng yêu cầu.

⚠️ QUAN TRỌNG — GIỚI HẠN DỮ LIỆU:
Bạn CHỈ được sử dụng thông tin được cung cấp bên dưới để trả lời. 
Dữ liệu đã được lọc theo quyền của người dùng hiện tại (role: ${ctx.userProjectRole || "không xác định"}).
${permissionHints}

${summary ? `📝 Tóm tắt lịch sử trò chuyện trước:\n${summary}\n` : ""}
${ctx.members ? `Thành viên dự án:\n${teamInfo || "Chưa có thành viên"}` : ""}

${ctx.tasks ? `Tasks hiện tại:\n${existingTasks || "Chưa có task nào"}` : ""}

${ctx.requirementsContent ? `Tài liệu yêu cầu:\n${ctx.requirementsContent}` : ""}

Available epics: ${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: ${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}
Task naming rule: ${ctx.project.taskNamingRule || "None"}

Detailed source files available for task creation:
${sourceManifest || "No uploaded source files."}
${docContents.inlineParts.length > 0 ? "Some detailed source files are attached to this conversation. Use them to clarify task scope, acceptance criteria, edge cases, and dependencies.\n" : ""}${docContents.textDocs.length > 0 ? `Detailed source text files:\n${docContents.textDocs.join("\n\n")}` : ""}

Task creation rules:
- Read requirements.md first to identify scope and candidate tasks.
- Use detailed source files only to clarify missing detail, edge cases, acceptance criteria, dependencies, and business rules.
- Avoid duplicate tasks already present in the project.
- Every task description must include measurable Acceptance Criteria and a Source refs line.
- Set "epic" from available epics only. Use null when no available epic fits.
- Set "labels" from available labels only. Use an empty array when no available label fits.
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
      "epic": "Tên epic hoặc null",
      "labels": ["FE", "BE"],
      "sprint": "Sprint 1 hoặc null",
      "estimateHours": <estimated hours or 0>,
      "loggedHours": <logged hours or 0>,
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
      {
        role: "user" as const,
        parts: [...docContents.inlineParts, { text: systemPrompt }],
      },
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

    // Filter suggested tasks: chỉ cho phép đề xuất nếu user có task:create
    if (parsed.createTasks?.length) {
      if (!ctx.userPermissions.includes("task:create")) {
        return {
          message:
            "Bạn không có quyền tạo task trong dự án này. Hãy liên hệ PM hoặc Tech Lead để được hỗ trợ.",
        };
      }

      return {
        message:
          parsed.message ||
          `AI đề xuất ${parsed.createTasks.length} task. Hãy review và chỉnh sửa trước khi tạo.`,
        suggestedTasks: parsed.createTasks.map((t: any) => ({
          title: t.title,
          description: t.description || "",
          priority: t.priority || "MEDIUM",
          dueDate: t.dueDate && t.dueDate !== "null" ? t.dueDate : undefined,
          epic: t.epic && t.epic !== "null" ? t.epic : undefined,
          labels: Array.isArray(t.labels)
            ? t.labels.filter((label: any) => typeof label === "string")
            : [],
          sprint: t.sprint && t.sprint !== "null" ? t.sprint : undefined,
          estimateHours: Number.isFinite(Number(t.estimateHours))
            ? Number(t.estimateHours)
            : 0,
          loggedHours: Number.isFinite(Number(t.loggedHours))
            ? Number(t.loggedHours)
            : 0,
          assigneeId: t.assigneeId || null,
        })),
      };
    }

    return { message: parsed.message || rawText.trim() };
  }

  async summarize(
    projectId: number,
    currentSummary: string,
    messages: ChatMessage[],
  ): Promise<string> {
    const convText = messages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");

    const prompt = `Tóm tắt ngắn gọn lịch sử trò chuyện quản lý dự án sau (tối đa 200 từ). Giữ lại các thông tin quan trọng: quyết định đã đưa ra, tasks đã đề xuất hoặc tạo, các yêu cầu chính đã đề cập. Viết dưới dạng văn xuôi súc tích.

${currentSummary ? `Tóm tắt trước đó:\n${currentSummary}\n\n` : ""}Tin nhắn mới:\n${convText}

Trả về chỉ đoạn tóm tắt, không giải thích thêm.`;

    const model = this.config.get("AI_MODEL", "gemma-4-31b-it");
    try {
      const result = await this.ai.models.generateContent({
        model,
        config: { temperature: 0.2 },
        contents: [{ role: "user" as const, parts: [{ text: prompt }] }],
      });
      return result.text?.trim() || currentSummary;
    } catch {
      return currentSummary;
    }
  }

  // ─── Helper: build permission hints for AI prompt ──────────────────────────

  private buildSourceManifest(
    sources: {
      id: number;
      originalName: string;
      mimeType: string | null;
      size: number;
      kind: "text" | "binary";
    }[] = [],
  ): string {
    if (!sources.length) return "";
    return sources
      .map(
        (source) =>
          `- ${source.originalName} (${source.kind}, ${source.mimeType || "unknown"}, ${source.size} bytes)`,
      )
      .join("\n");
  }
  private buildPermissionHints(ctx: FilteredProjectContext): string {
    const hints: string[] = [];

    if (!ctx.members) {
      hints.push(
        "- Bạn KHÔNG có thông tin thành viên (user không có quyền project:read)",
      );
    }
    if (!ctx.tasks) {
      hints.push(
        "- Bạn KHÔNG có thông tin task (user không có quyền task:read)",
      );
    }
    if (!ctx.requirementsContent) {
      hints.push(
        "- Bạn KHÔNG có tài liệu yêu cầu (user không có quyền ai:analyze hoặc chưa có tài liệu)",
      );
    }
    if (!ctx.userPermissions.includes("task:create")) {
      hints.push(
        "- User KHÔNG có quyền tạo task — KHÔNG đề xuất tạo task mới",
      );
    }
    if (!ctx.userPermissions.includes("task:update")) {
      hints.push("- User KHÔNG có quyền cập nhật task");
    }
    if (!ctx.userPermissions.includes("task:delete")) {
      hints.push("- User KHÔNG có quyền xóa task");
    }

    return hints.length > 0 ? hints.join("\n") : "- User có đầy đủ quyền truy cập dữ liệu dự án.";
  }

  // ─── Helper: build requirements markdown ───────────────────────────────────

  private buildRequirementsMarkdown(
    ctx: FilteredProjectContext,
    analysis: AiAnalysisResult,
  ): string {
    const now = formatRequirementTimestamp();
    const lines: string[] = [
      `# Tài liệu Yêu cầu Dự án: ${ctx.project.name}`,
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
      `| # | Task | Epic | Labels | Mô tả | Ưu tiên | Role |`,
      `|---|------|------|--------|-------|---------|------|`,
      ...(analysis.suggestedTasks || []).map(
        (t, i) =>
          `| ${i + 1} | ${t.title} | ${t.epic || "—"} | ${t.labels?.join(", ") || "—"} | ${(t.description || "").replace(/\n/g, " ")} | ${t.priority} | ${t.suggestedRole || "—"} |`,
      ),
      ``,
      `## Thông tin dự án`,
      ``,
      `- **Tên dự án:** ${ctx.project.name}`,
      `- **Mô tả:** ${ctx.project.description || "N/A"}`,
      `- **Ngày bắt đầu:** ${ctx.project.startDate ? new Date(ctx.project.startDate).toLocaleDateString("vi-VN") : "N/A"}`,
      `- **Ngày kết thúc:** ${ctx.project.endDate ? new Date(ctx.project.endDate).toLocaleDateString("vi-VN") : "N/A"}`,
    ];
    return lines.join("\n");
  }

  // ── Chat session CRUD ───────────────────────────────────────────────────────

  async listSessions(projectId: number, userId: number) {
    return this.prisma.aiChatSession.findMany({
      where: { projectId, userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        summary: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createSession(projectId: number, userId: number, name: string) {
    return this.prisma.aiChatSession.create({
      data: { projectId, userId, name, messages: [] },
    });
  }

  async updateSession(
    sessionId: number,
    userId: number,
    data: { name?: string; summary?: string; messages?: any[] },
  ) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async deleteSession(sessionId: number, userId: number) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    await this.prisma.aiChatSession.delete({ where: { id: sessionId } });
    return { success: true };
  }
}
