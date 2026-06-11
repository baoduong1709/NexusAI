const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = 'c:/Project/NexusAI';
const skillDir = 'C:/Users/bao/.gemini/config/plugins/understand-anything-plugin/skills/understand';
const batchesFile = path.join(projectRoot, '.understand-anything/intermediate/batches.json');
const tmpDir = path.join(projectRoot, '.understand-anything/tmp');

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(batchesFile, 'utf8'));
const batches = data.batches;

console.log(`Preparing inputs for ${batches.length} batches...`);

batches.forEach(b => {
  const batchIndex = b.batchIndex;
  const inputPath = path.join(tmpDir, `ua-file-analyzer-input-${batchIndex}.json`);
  const outputPath = path.join(tmpDir, `ua-file-extract-results-${batchIndex}.json`);
  
  const inputData = {
    projectRoot: projectRoot,
    batchFiles: b.files,
    batchImportData: b.batchImportData
  };
  
  fs.writeFileSync(inputPath, JSON.stringify(inputData, null, 2), 'utf8');
  console.log(`Wrote input for Batch ${batchIndex}`);
  
  // Run extract-structure.mjs
  try {
    console.log(`Running extract-structure for Batch ${batchIndex}...`);
    execSync(`node "${path.join(skillDir, 'extract-structure.mjs')}" "${inputPath}" "${outputPath}"`, { stdio: 'inherit' });
    console.log(`Successfully extracted structure for Batch ${batchIndex}`);
  } catch (err) {
    console.error(`Error extracting structure for Batch ${batchIndex}:`, err.message);
  }
});
