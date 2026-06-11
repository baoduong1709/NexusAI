const fs = require('fs');
const batches = JSON.parse(fs.readFileSync('c:/Project/NexusAI/.understand-anything/intermediate/batches.json', 'utf8'));
console.log(`Total batches: ${batches.batches.length}`);
batches.batches.forEach(b => {
  console.log(`Batch ${b.batchIndex}: ${b.files.length} files`);
  b.files.forEach(f => console.log(`  - ${f.path} (${f.language}, ${f.sizeLines} lines, ${f.fileCategory})`));
});
