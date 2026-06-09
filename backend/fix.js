const fs = require('fs');
let code = fs.readFileSync('src/ai/ai.service.ts', 'utf-8');
code = code.replace(/`task:create`\./, "'task:create'.");
fs.writeFileSync('src/ai/ai.service.ts', code);
