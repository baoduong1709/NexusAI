const fs = require('fs');

const path = './src/ai/ai.service.ts';
let code = fs.readFileSync(path, 'utf-8');

const chatStreamCode = `

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

    const teamInfo = ctx.members
      ? ctx.members
          .map(
            (m) =>
              \`ID:\${m.userId} - \${m.name} (\${m.projectRole || m.globalRole || "No role"}, skills: \${m.skills.join(", ")})\`,
          )
          .join("\\n")
      : "";

    const existingTasks = ctx.tasks
      ? ctx.tasks
          .map(
            (t) =>
              \`- \${t.id} [\${t.status}] \${t.title} (epic: \${t.epic || "none"}, labels: \${t.labels.length ? t.labels.join(", ") : "none"}, sprint: \${t.sprint || "none"})\`,
          )
          .join("\\n")
      : "";

    const permissionHints = this.buildPermissionHints(ctx);

    const systemPrompt = \`Bạn là AI assistant quản lý dự án "\${ctx.project.name}". 
Bạn có thể trả lời câu hỏi và ĐỀ XUẤT TASK khi người dùng yêu cầu.

⚠️ QUAN TRỌNG — GIỚI HẠN DỮ LIỆU:
Bạn CHỈ được sử dụng thông tin được cung cấp bên dưới để trả lời. 
Dữ liệu đã được lọc theo quyền của người dùng hiện tại (role: \${ctx.userProjectRole || "không xác định"}).
\${permissionHints}

\${summary ? \`📝 Tóm tắt lịch sử trò chuyện trước:\\n\${summary}\\n\` : ""}
\${ctx.members ? \`Thành viên dự án:\\n\${teamInfo || "Chưa có thành viên"}\` : ""}

\${ctx.tasks ? \`Tasks hiện tại:\\n\${existingTasks || "Chưa có task nào"}\` : ""}

\${ctx.requirementsContent ? \`Tài liệu yêu cầu:\\n\${ctx.requirementsContent}\` : ""}

Available epics: \${ctx.project.epics.length ? ctx.project.epics.join(", ") : "None"}
Available labels: \${ctx.project.labels.length ? ctx.project.labels.join(", ") : "None"}

Detailed source files:
\${sourceManifest || "No uploaded source files."}
\${docContents.textDocs.length > 0 ? \`\\n\${docContents.textDocs.join("\\n\\n")}\` : ""}

Task creation rules:
- Hãy trả lời bằng văn bản Markdown tự nhiên. KHÔNG bọc toàn bộ câu trả lời trong JSON.
- Nếu người dùng yêu cầu tạo task (ví dụ: "tạo task cho module X"), hãy trả lời bằng văn bản, sau đó BẮT BUỘC bọc danh sách task đề xuất trong một block JSON ở cuối câu trả lời với định dạng chính xác như sau:
\\\`\\\`\\\`json
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
\\\`\\\`\\\`
- Chỉ đề xuất task nếu người dùng có quyền \`task:create\`.
\`;

    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.config.get("AI_MODEL", "deepseek-v4-pro[1m]"),
        messages: openaiMessages,
        stream: true,
        temperature: 0.4,
      });

      let fullText = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullText += delta.content;
          res.write(\`data: \${JSON.stringify({ text: delta.content })}\\n\\n\`);
        }
      }

      // Filter tasks permission
      if (ctx.userPermissions.includes("task:create")) {
        const jsonMatch = fullText.match(/\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/);
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
               res.write(\`event: suggest_tasks\\ndata: \${JSON.stringify(tasks)}\\n\\n\`);
            }
          } catch (e) {
            this.logger.error("Failed to parse suggested tasks json", e);
          }
        }
      }

      res.write('event: done\\ndata: {}\\n\\n');
      res.end();
    } catch (error: any) {
      this.logger.error("chatStream failed", error);
      res.write(\`event: error\\ndata: \${JSON.stringify({ message: error.message })}\\n\\n\`);
      res.end();
    }
  }
`;

// Insert before the last closing brace
const lastBraceIndex = code.lastIndexOf('}');
if (lastBraceIndex !== -1) {
    code = code.substring(0, lastBraceIndex) + chatStreamCode + '\n}\n';
    fs.writeFileSync(path, code);
    console.log("Updated ai.service.ts");
} else {
    console.error("Could not find closing brace");
}
