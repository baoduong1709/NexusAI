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
import { RagService } from "./rag.service";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { ProjectAiIndexService } from "../project-ai-index/project-ai-index.service";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  tasksCreated?: { id: string; title: string }[];
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

type ChatIntent =
  | "simple_chat"
  | "project_question"
  | "task_suggestion"
  | "document_question"
  | "unknown";

interface ChatPlan {
  intent: ChatIntent;
  complexity: "simple" | "complex";
  needsData: (
    | "project"
    | "members"
    | "task_counts"
    | "tasks"
    | "requirements"
    | "documents"
  )[];
  shouldAnswerDirectly: boolean;
  directAnswer?: string;
  reason?: string;
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
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private tasksService: TasksService,
    private dataAccess: AiDataAccessService,
    private ragService: RagService,
    private projectAiIndex: ProjectAiIndexService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get("AI_API_KEY", ""),
      baseURL: this.config.get("AI_API_BASE", "https://api.ai-box.vn/v1"),
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

  /**
   * Helper to generate AI text response using OpenAI Chat Completions with stream
   */
  private async generateAiText(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    context: string,
    temperature = 0.3,
  ): Promise<string> {
    const model = this.config.get("AI_MODEL", "deepseek-v4-pro[1m]");
    let lastError: any;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        let text = "";
        const stream = await this.openai.chat.completions.create({
          model,
          messages,
          temperature,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          text += content;
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
      message: "AI provider temporarily failed. Please try again in a moment.",
      detail: this.getAiErrorMessage(lastError),
      status: this.getAiErrorStatus(lastError),
    });
  }

  private parseJsonObject(text: string): any | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  private fallbackChatPlan(message: string): ChatPlan {
    const normalized = message.toLowerCase();
    if (
      /(^|\s)(tao|tạo|de xuat|đề xuất|chia|generate|create)\s+(task|tasks|cong viec|công việc)/i.test(
        normalized,
      )
    ) {
      return {
        intent: "task_suggestion",
        complexity: "complex",
        needsData: ["project", "members", "tasks", "requirements", "documents"],
        shouldAnswerDirectly: false,
        reason: "Message asks to create or suggest tasks.",
      };
    }

    if (/tai lieu|tài liệu|requirement|requirements|file|source|document/i.test(normalized)) {
      return {
        intent: "document_question",
        complexity: "complex",
        needsData: ["project", "requirements", "documents"],
        shouldAnswerDirectly: false,
        reason: "Message asks about requirements or documents.",
      };
    }

    if (/task|tasks|cong viec|công việc|member|thanh vien|thành viên|project|du an|dự án/i.test(normalized)) {
      return {
        intent: "project_question",
        complexity: "simple",
        needsData: ["project", "task_counts", "tasks", "members"],
        shouldAnswerDirectly: false,
        reason: "Message asks about project data.",
      };
    }

    return {
      intent: "simple_chat",
      complexity: "simple",
      needsData: ["project"],
      shouldAnswerDirectly: true,
      reason: "Message can be answered conversationally with minimal project context.",
    };
  }

  private normalizeChatPlan(value: any, fallback: ChatPlan): ChatPlan {
    if (!value || typeof value !== "object") return fallback;
    const validIntents: ChatIntent[] = [
      "simple_chat",
      "project_question",
      "task_suggestion",
      "document_question",
      "unknown",
    ];
    const validNeeds = new Set([
      "project",
      "members",
      "task_counts",
      "tasks",
      "requirements",
      "documents",
    ]);

    const intent = validIntents.includes(value.intent)
      ? value.intent
      : fallback.intent;
    const needsData = Array.isArray(value.needsData)
      ? value.needsData.filter((item: unknown) => validNeeds.has(String(item)))
      : fallback.needsData;

    return {
      intent,
      complexity: value.complexity === "complex" ? "complex" : "simple",
      needsData: needsData.length ? needsData : fallback.needsData,
      shouldAnswerDirectly: Boolean(value.shouldAnswerDirectly),
      directAnswer:
        typeof value.directAnswer === "string" ? value.directAnswer : undefined,
      reason: typeof value.reason === "string" ? value.reason : fallback.reason,
    };
  }

  private async classifyChatRequest(
    ctx: FilteredProjectContext,
    messages: ChatMessage[],
    summary?: string,
    projectIndex?: unknown,
  ): Promise<ChatPlan> {
    const lastMessage = messages[messages.length - 1]?.content?.trim() || "";
    const fallback = this.fallbackChatPlan(lastMessage);
    if (!lastMessage) return fallback;

    const recentMessages = messages
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = `Classify the user's latest project-management chat message.
Return only JSON with this schema:
{
  "intent": "simple_chat | project_question | task_suggestion | document_question | unknown",
  "complexity": "simple | complex",
  "needsData": ["project", "members", "task_counts", "tasks", "requirements", "documents"],
  "shouldAnswerDirectly": true,
  "directAnswer": "short answer when no project data is needed",
  "reason": "short reason"
}

Rules:
- simple_chat: greetings, thanks, capability questions, or general conversation. Use shouldAnswerDirectly=true when possible.
- project_question: asks about project status, members, tasks, progress, counts, blockers, workload.
- task_suggestion: asks to create/suggest/split/generate tasks. Needs tasks, members, requirements, and documents.
- document_question: asks about requirements, uploaded documents, source files, or specs.
- Only include data that is necessary.
- If answering directly, keep directAnswer concise and in the same language as the user.

Project: ${ctx.project.name}
User permissions: ${ctx.userPermissions.join(", ") || "none"}
Project AI index:
${projectIndex ? JSON.stringify(projectIndex).slice(0, 4000) : "none"}
Conversation summary: ${summary || "none"}
Recent messages:
${recentMessages}`;

    try {
      const raw = await this.generateAiText(
        [{ role: "user", content: prompt }],
        "chat classifier",
        0,
      );
      return this.normalizeChatPlan(this.parseJsonObject(raw), fallback);
    } catch (error) {
      this.logger.warn(`Chat classifier failed, using fallback plan`);
      return fallback;
    }
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

${docContents.textDocs.length > 0 ? `Detailed source text/markdown files:\n${docContents.textDocs.join("\n\n")}` : "Detailed source files: No documents uploaded"}

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
      const responseText = await this.generateAiText(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        "project analysis",
        0.3,
      );

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

      this.projectAiIndex.rebuildSoon(projectId);
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
      const text = await this.generateAiText(
        [{ role: "user", content: prompt }],
        "suggest assignee",
        0.2,
      );

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

    const improved = await this.generateAiText(
      [{ role: "user", content: prompt }],
      "description improve",
      0.2,
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

    const raw = await this.generateAiText(
      [{ role: "user", content: prompt }],
      "description assist",
      0.2,
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        message: "Đã cập nhật description theo yêu cầu.",
        description: raw.trim(),
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message:
          String(parsed.message || "").trim() ||
          "Đã cập nhật description theo yêu cầu.",
        description: String(parsed.description || "").trim() || description,
      };
    } catch {
      return {
        message: "Đã cập nhật description theo yêu cầu.",
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
      `> Tạo lúc: ${now} - Chưa phân tích AI`,
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
    this.projectAiIndex.rebuildSoon(projectId);
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

${docContents.textDocs.length > 0 ? `Text source documents:\n${docContents.textDocs.join("\n\n")}\n` : ""}

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

    let content = await this.generateAiText(
      [{ role: "user", content: prompt }],
      "requirements update",
      0.3,
    );

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

        const diffText = await this.generateAiText(
          [{ role: "user", content: diffPrompt }],
          "requirements diff summary",
          0.2,
        );
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
    this.projectAiIndex.rebuildSoon(projectId);

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
    const baseCtx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
      {
        includeMembers: false,
        includeTasks: false,
        includeDocuments: false,
        includeRequirements: false,
      },
    );
    const projectIndex =
      (await this.projectAiIndex.get(projectId)) ??
      (await this.projectAiIndex.rebuild(projectId));
    const plan = await this.classifyChatRequest(
      baseCtx,
      messages,
      summary,
      projectIndex,
    );

    if (
      plan.shouldAnswerDirectly &&
      plan.intent === "simple_chat" &&
      plan.directAnswer
    ) {
      return { message: plan.directAnswer };
    }

    if (plan.intent !== "task_suggestion") {
      const needs = new Set(plan.needsData);
      const includeTasks = needs.has("tasks");
      const includeDocuments =
        needs.has("documents") || plan.intent === "document_question";
      const ctx = await this.dataAccess.getFilteredProjectContext(
        projectId,
        userId,
        {
          includeMembers: needs.has("members"),
          includeTasks,
          includeDocuments,
          includeRequirements:
            needs.has("requirements") || plan.intent === "document_question",
        },
      );
      const docContents = includeDocuments
        ? await this.dataAccess.getFilteredDocumentContents(projectId, userId)
        : { textDocs: [], inlineParts: [], sources: [] };
      const taskCounts = ctx.tasks
        ? ctx.tasks.reduce<Record<string, number>>((counts, task) => {
            counts[task.status] = (counts[task.status] || 0) + 1;
            return counts;
          }, {})
        : {};
      const tasks = ctx.tasks
        ? ctx.tasks
            .map(
              (t) =>
                `- ${t.id} [${t.status}] ${t.title} (assignee: ${t.assigneeName || "none"}, priority: ${t.priority})`,
            )
            .join("\n")
        : "";
      const members = ctx.members
        ? ctx.members
            .map((m) => `- ${m.name} (${m.projectRole || m.globalRole || "No role"})`)
            .join("\n")
        : "";
      const prompt = `You are the AI assistant for project "${ctx.project.name}".
Answer in the same language as the user. Return only JSON: {"message":"..."}.
Use only the selected context below. If data is missing, say what is missing.

Routing plan:
- intent: ${plan.intent}
- complexity: ${plan.complexity}
- selected data: ${plan.needsData.join(", ") || "none"}
- reason: ${plan.reason || "none"}

Permissions:
${this.buildPermissionHints(ctx)}

${summary ? `Conversation summary:\n${summary}\n` : ""}
Project:
- name: ${ctx.project.name}
- description: ${ctx.project.description || "N/A"}
- status: ${ctx.project.status}

Project AI index:
${projectIndex ? JSON.stringify(projectIndex).slice(0, 6000) : "No index available."}

${ctx.members ? `Members:\n${members || "No members."}` : ""}
${ctx.tasks ? `Task counts:\n${Object.entries(taskCounts).map(([status, count]) => `- ${status}: ${count}`).join("\n") || "No tasks."}` : ""}
${ctx.tasks && needs.has("tasks") ? `Tasks:\n${tasks || "No tasks."}` : ""}
${ctx.requirementsContent ? `Requirements:\n${ctx.requirementsContent}` : ""}
${includeDocuments ? `Documents:\n${this.buildSourceManifest(docContents.sources) || "No uploaded source files."}` : ""}
${includeDocuments && docContents.textDocs.length > 0 ? `Document text:\n${docContents.textDocs.join("\n\n")}` : ""}`;

      const rawText = await this.generateAiText(
        [
          { role: "system", content: prompt },
          ...messages.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
        ],
        "planned chat response",
        0.3,
      );
      const parsed = this.parseJsonObject(rawText);
      return { message: parsed?.message || rawText.trim() };
    }

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
              `- ${t.id} [${t.status}] ${t.title} (epic: ${t.epic || "none"}, labels: ${t.labels.length ? t.labels.join(", ") : "none"}, sprint: ${t.sprint || "none"}, est: ${t.estimateHours}h, logged: ${t.loggedHours}h)`,
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

Project AI index:
${projectIndex ? JSON.stringify(projectIndex).slice(0, 6000) : "No index available."}

${summary ? `📝 Tóm tắt lịch sử trò chuyện trước:\n${summary}\n` : ""}
${ctx.members ? `Thành viên dự án:\n${teamInfo || "Chưa có thành viên"}` : ""}

${ctx.tasks ? `Tasks hiện tại:\n${existingTasks || "Chưa có task nào"}` : ""}

${ctx.requirementsContent ? `Tài liệu yêu cầu:\n${ctx.requirementsContent}` : ""}

Available epics: ${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: ${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}
Task naming rule: ${ctx.project.taskNamingRule || "None"}

Detailed source files available for task creation:
${sourceManifest || "No uploaded source files."}
${docContents.textDocs.length > 0 ? `Detailed source text/markdown files:\n${docContents.textDocs.join("\n\n")}` : ""}

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

    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "assistant" as const,
        content: '{"message": "Xin chào! Tôi sẵn sàng hỗ trợ bạn quản lý dự án. Bạn có thể hỏi tôi về dự án hoặc yêu cầu tạo task."}',
      },
      ...messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ];

    let rawText = await this.generateAiText(openaiMessages, "chat session", 0.4);

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

    try {
      const result = await this.generateAiText(
        [{ role: "user", content: prompt }],
        "chat summary",
        0.2,
      );
      return result?.trim() || currentSummary;
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


  async chatStream(
    projectId: number,
    userId: number,
    messages: ChatMessage[],
    summary: string | undefined,
    res: any
  ) {
    const ctx = await this.dataAccess.getFilteredProjectContext(
      projectId,
      userId,
    );
    const docContents = await this.dataAccess.getFilteredDocumentContents(
      projectId,
      userId,
    );
    const sourceManifest = this.buildSourceManifest(docContents.sources);

    const permissionHints = this.buildPermissionHints(ctx);

    const systemPrompt = `Bạn là AI assistant quản lý dự án "${ctx.project.name}". 
Bạn có thể trả lời câu hỏi và ĐỀ XUẤT TASK khi người dùng yêu cầu.

⚠️ QUAN TRỌNG — GIỚI HẠN DỮ LIỆU & TOOLS:
Bạn CHỈ được sử dụng thông tin được cung cấp. Bạn có thể sử dụng các function (tools) để tìm kiếm thông tin về members, tasks, và nội dung TÀI LIỆU YÊU CẦU (document) khi cần thiết.
Dữ liệu đã được lọc theo quyền của người dùng hiện tại (role: ${ctx.userProjectRole || "không xác định"}).
${permissionHints}

${summary ? `📝 Tóm tắt lịch sử trò chuyện trước:\n${summary}\n` : ""}

${ctx.requirementsContent ? `Tài liệu yêu cầu:\n${ctx.requirementsContent}` : ""}

Available epics: ${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: ${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}

Detailed source files:
${sourceManifest || "No uploaded source files."}
${docContents.textDocs.length > 0 ? `\n${docContents.textDocs.join("\n\n")}` : ""}

Task creation rules:
- Hãy trả lời bằng văn bản Markdown tự nhiên. KHÔNG bọc toàn bộ câu trả lời trong JSON.
- Nếu người dùng yêu cầu tạo task (ví dụ: "tạo task cho module X"), hãy trả lời bằng văn bản, sau đó BẮT BUỘC bọc danh sách task đề xuất trong một block JSON ở cuối câu trả lời với định dạng chính xác như sau:
\`\`\`json
{
  "createTasks": [
    {
      "title": "Tên task",
      "description": "Mô tả chi tiết",
      "priority": "HIGH|MEDIUM|LOW",
      "dueDate": "YYYY-MM-DD hoặc null",
      "epic": "Tên epic hoặc null",
      "labels": ["FE", "BE"],
      "sprint": "Sprint 1 hoặc null",
      "estimateHours": 0,
      "assigneeId": null
    }
  ]
}
\`\`\`
- Chỉ đề xuất task nếu người dùng có quyền \`task:create\`.
`;

    const availableTools = [
      {
        type: "function" as const,
        function: {
          name: "search_document",
          description: "Tìm kiếm thông tin trong tài liệu yêu cầu (requirements/documents) của dự án. TRUY VẤN BẰNG TIẾNG ANH HOẶC TIẾNG VIỆT ĐỀU ĐƯỢC.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Câu hỏi hoặc từ khóa cần tìm kiếm trong tài liệu." }
            },
            required: ["query"]
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_project_members",
          description: "Lấy danh sách các thành viên trong dự án và kỹ năng của họ. Sử dụng khi cần tìm người phù hợp để assign task.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_project_tasks",
          description: "Lấy danh sách các task hiện có trong dự án. Có thể lọc theo trạng thái (status). Sử dụng khi cần biết dự án đang có task gì, ai làm.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Trạng thái task (TODO, IN_PROGRESS, REVIEW, DONE). Bỏ trống nếu muốn lấy tất cả." },
              assigneeId: { type: "number", description: "ID của thành viên được giao" }
            },
          },
        },
      }
    ];

    let currentMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    try {
      let finalFullText = "";

      while (true) {
        const stream = await this.openai.chat.completions.create({
          model: this.config.get("AI_MODEL", "deepseek-v4-pro[1m]"),
          messages: currentMessages,
          stream: true,
          temperature: 0.4,
          tools: availableTools,
        });

        let fullText = "";
        let toolCalls: any[] = [];

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;
              if (index !== undefined) {
                if (!toolCalls[index]) {
                  toolCalls[index] = { id: tc.id, type: tc.type, function: { name: tc.function?.name || "", arguments: "" } };
                }
                if (tc.function?.arguments) {
                  toolCalls[index].function.arguments += tc.function.arguments;
                }
              }
            }
          } else if (delta?.content) {
            fullText += delta.content;
            res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
          }
        }

        finalFullText += fullText;

        if (toolCalls.length > 0) {
          toolCalls = toolCalls.filter(Boolean);
          
          currentMessages.push({
            role: "assistant",
            content: fullText || null,
            tool_calls: toolCalls
          });

          for (const tc of toolCalls) {
            let result = "";
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              if (tc.function.name === "get_project_members") {
                 result = JSON.stringify(ctx.members?.map(m => ({ id: m.userId, name: m.name, role: m.projectRole, skills: m.skills })) || []);
              } else if (tc.function.name === "search_document") {
                 const searchResults = await this.ragService.searchDocuments(projectId, args.query);
                 result = JSON.stringify(searchResults);
              } else if (tc.function.name === "get_project_tasks") {
                 let tasks = ctx.tasks || [];
                 if (args.status) tasks = tasks.filter(t => t.status === args.status);
                 if (args.assigneeId) tasks = tasks.filter(t => t.assigneeId === args.assigneeId);
                 result = JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, status: t.status, assigneeId: t.assigneeId })));
              }
            } catch (e: any) {
              result = `Error: ${e.message}`;
            }
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result
            });
          }
        } else {
          // No more tool calls, exit loop
          break;
        }
      }

      // Filter tasks permission
      if (ctx.userPermissions.includes("task:create")) {
        const jsonMatch = finalFullText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.createTasks && Array.isArray(parsed.createTasks)) {
               const tasks = parsed.createTasks.map((t: any) => ({
                 title: t.title,
                 description: t.description || "",
                 priority: t.priority || "MEDIUM",
                 dueDate: t.dueDate && t.dueDate !== "null" ? t.dueDate : undefined,
                 epic: t.epic && t.epic !== "null" ? t.epic : undefined,
                 labels: Array.isArray(t.labels) ? t.labels : [],
                 sprint: t.sprint && t.sprint !== "null" ? t.sprint : undefined,
                 estimateHours: Number(t.estimateHours) || 0,
                 assigneeId: t.assigneeId || null,
               }));
               res.write(`event: suggest_tasks\ndata: ${JSON.stringify(tasks)}\n\n`);
            }
          } catch (e) {
            this.logger.error("Failed to parse suggested tasks json", e);
          }
        }
      }

      res.write('event: done\ndata: {}\n\n');
      res.end();
    } catch (error: any) {
      this.logger.error("chatStream failed", error);
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }

}
