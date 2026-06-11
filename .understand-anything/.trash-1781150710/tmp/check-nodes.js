const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, 'ua-tour-input.json');
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const targetIds = [
    "file:frontend/components/ai-chat-bubble.tsx",
    "file:backend/src/ai/agent-runtime.util.ts"
];

const found = [];
const notFound = [];

targetIds.forEach(id => {
    const node = inputData.nodes.find(n => n.id === id);
    if (node) {
        found.push(node);
    } else {
        notFound.push(id);
    }
});

console.log("FOUND NODES:");
found.forEach(n => console.log(`- ${n.id} (${n.type}): ${n.name}\n  Summary: ${n.summary}\n`));

console.log("NOT FOUND NODES:", notFound);
