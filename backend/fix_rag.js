const fs = require('fs');

// Fix ai.service.ts
let aiCode = fs.readFileSync('src/ai/ai.service.ts', 'utf-8');
if (!aiCode.includes('import { RagService }')) {
  aiCode = aiCode.replace(
    'import { AiDataAccessService } from "./ai-data-access.service";',
    'import { AiDataAccessService } from "./ai-data-access.service";\nimport { RagService } from "./rag.service";'
  );
  fs.writeFileSync('src/ai/ai.service.ts', aiCode);
}

// Fix rag.service.ts
let ragCode = fs.readFileSync('src/ai/rag.service.ts', 'utf-8');
ragCode = ragCode.replace(/\\`/g, "`").replace(/\\\$/g, "$");
fs.writeFileSync('src/ai/rag.service.ts', ragCode);

console.log("Fixed files");
