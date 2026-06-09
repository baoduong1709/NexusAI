const fs = require('fs');

const path = './src/ai/ai.service.ts';
let code = fs.readFileSync(path, 'utf-8');

// 1. Add import
if (!code.includes('import { RagService }')) {
  code = code.replace(
    /import \{ AiDataAccessService \} from "\.\/ai-data-access\.service";/,
    'import { AiDataAccessService } from "./ai-data-access.service";\nimport { RagService } from "./rag.service";'
  );
}

// 2. Add to constructor
if (!code.includes('private ragService: RagService')) {
  code = code.replace(
    /private dataAccess: AiDataAccessService,/,
    'private dataAccess: AiDataAccessService,\n    private ragService: RagService,'
  );
}

// 3. Add to systemPrompt in chatStream
code = code.replace(
  /Bạn có thể sử dụng các function \(tools\) để tìm kiếm thông tin về members và tasks khi cần thiết thay vì đoán./,
  'Bạn có thể sử dụng các function (tools) để tìm kiếm thông tin về members, tasks, và nội dung TÀI LIỆU YÊU CẦU (document) khi cần thiết.'
);

// Remove the context dump of requirementsContent from systemPrompt
code = code.replace(
  /\$\\{ctx\.requirementsContent \? \`Tài liệu yêu cầu:\\\\n\$\\{ctx\.requirementsContent\\}\` : ""\\}/,
  ''
);

// 4. Add tool
const newTool = `      {
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
      }`;

if (!code.includes('"search_document"')) {
  code = code.replace(
    /const availableTools = \[/,
    `const availableTools = [\n${newTool},`
  );
}

// 5. Add tool handler
const toolHandlerRegex = /\} else if \(tc\.function\.name === "get_project_tasks"\) \{/;
if (code.match(toolHandlerRegex)) {
  code = code.replace(
    toolHandlerRegex,
    `} else if (tc.function.name === "search_document") {
                 const searchResults = await this.ragService.searchDocuments(projectId, args.query);
                 result = JSON.stringify(searchResults);
              } else if (tc.function.name === "get_project_tasks") {`
  );
}

fs.writeFileSync(path, code);
console.log("Updated ai.service.ts for RAG tool");
