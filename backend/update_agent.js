const fs = require('fs');

const path = './src/ai/ai.service.ts';
let code = fs.readFileSync(path, 'utf-8');

const regex = /  async chatStream\([\s\S]*?res\.end\(\);\n    \} catch \(error: any\) \{\n      this\.logger\.error\("chatStream failed", error\);\n      res\.write\(`event: error\\ndata: \$\{JSON\.stringify\(\{ message: error\.message \}\)\}\\n\\n`\);\n      res\.end\(\);\n    \}\n  \}/;

const newChatStream = `  async chatStream(
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

    const systemPrompt = \`Bạn là AI assistant quản lý dự án "\${ctx.project.name}". 
Bạn có thể trả lời câu hỏi và ĐỀ XUẤT TASK khi người dùng yêu cầu.

⚠️ QUAN TRỌNG — GIỚI HẠN DỮ LIỆU & TOOLS:
Bạn CHỈ được sử dụng thông tin được cung cấp. Bạn có thể sử dụng các function (tools) để tìm kiếm thông tin về members và tasks khi cần thiết thay vì đoán.
Dữ liệu đã được lọc theo quyền của người dùng hiện tại (role: \${ctx.userProjectRole || "không xác định"}).
\${permissionHints}

\${summary ? \`📝 Tóm tắt lịch sử trò chuyện trước:\\n\${summary}\\n\` : ""}

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

    const availableTools = [
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
            res.write(\`data: \${JSON.stringify({ text: delta.content })}\\n\\n\`);
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
              } else if (tc.function.name === "get_project_tasks") {
                 let tasks = ctx.tasks || [];
                 if (args.status) tasks = tasks.filter(t => t.status === args.status);
                 if (args.assigneeId) tasks = tasks.filter(t => t.assigneeId === args.assigneeId);
                 result = JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, status: t.status, assigneeId: t.assigneeId })));
              }
            } catch (e: any) {
              result = \`Error: \${e.message}\`;
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
        const jsonMatch = finalFullText.match(/\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/);
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
  }`;

if (regex.test(code)) {
    code = code.replace(regex, newChatStream);
    fs.writeFileSync(path, code);
    console.log("Replaced chatStream with ReAct agent loop");
} else {
    console.error("Could not find chatStream method");
}
