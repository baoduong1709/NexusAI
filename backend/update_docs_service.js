const fs = require('fs');

const path = './src/documents/documents.service.ts';
let code = fs.readFileSync(path, 'utf-8');

// 1. Add import
if (!code.includes('import { RagService }')) {
  code = code.replace(
    /import \{ MarkitdownService \} from "\.\/markitdown\.service";/,
    'import { MarkitdownService } from "./markitdown.service";\nimport { RagService } from "../ai/rag.service";\nimport * as fs from "fs";'
  );
}

// 2. Add to constructor
if (!code.includes('private ragService: RagService')) {
  code = code.replace(
    /private markitdownService: MarkitdownService,/,
    'private markitdownService: MarkitdownService,\n    private ragService: RagService,'
  );
}

// 3. Trigger indexDocument after markdown is generated
const mdRegex = /this\.markitdownService\n        \.convertToMarkdown\(file\.path, \`\$\{file\.path\}\.md\`\)\n        \.catch\(\(\) => \{\}\);/;
if (code.match(mdRegex)) {
  code = code.replace(
    mdRegex,
    `this.markitdownService
        .convertToMarkdown(file.path, \`\$\{file.path\}.md\`)
        .then(() => {
           // Read markdown and index it
           try {
             const mdContent = fs.readFileSync(\`\$\{file.path\}.md\`, "utf-8");
             this.ragService.indexDocument(projectId, document.id, mdContent, document.originalName);
           } catch(e) {}
        })
        .catch(() => {});`
  );
}

fs.writeFileSync(path, code);
console.log("Updated documents.service.ts for RAG indexing");
