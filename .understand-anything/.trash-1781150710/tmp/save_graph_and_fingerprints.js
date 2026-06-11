const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = 'c:/Project/NexusAI';
const skillDir = 'C:/Users/bao/.gemini/config/plugins/understand-anything-plugin/skills/understand';
const intermediateDir = path.join(projectRoot, '.understand-anything/intermediate');
const finalGraphPath = path.join(projectRoot, '.understand-anything/knowledge-graph.json');
const assembledGraphPath = path.join(intermediateDir, 'assembled-graph.json');
const scanResultPath = path.join(intermediateDir, 'scan-result.json');
const metaPath = path.join(projectRoot, '.understand-anything/meta.json');
const commitHash = '67113e328a793bcc5853240bbabcaff1ec43dc55';

console.log('Saving knowledge graph...');

// 1. Copy final graph
fs.copyFileSync(assembledGraphPath, finalGraphPath);
console.log('Successfully copied assembled-graph.json to knowledge-graph.json');

// 2. Prepare fingerprint input
const scanResult = JSON.parse(fs.readFileSync(scanResultPath, 'utf8'));
const sourceFilePaths = scanResult.files.map(f => f.path);

const fingerprintInput = {
  projectRoot: projectRoot,
  sourceFilePaths: sourceFilePaths,
  gitCommitHash: commitHash
};

const fingerprintInputPath = path.join(intermediateDir, 'fingerprint-input.json');
fs.writeFileSync(fingerprintInputPath, JSON.stringify(fingerprintInput, null, 2), 'utf8');
console.log(`Wrote fingerprint-input.json with ${sourceFilePaths.length} source files.`);

// Run build-fingerprints.mjs
try {
  const scriptPath = path.join(skillDir, 'build-fingerprints.mjs');
  console.log(`Running build-fingerprints.mjs...`);
  const stdout = execSync(`node "${scriptPath}" "${fingerprintInputPath}"`, { encoding: 'utf8' });
  console.log(stdout);
  
  if (!stdout.includes('Fingerprints baseline:')) {
    throw new Error('Output does not contain "Fingerprints baseline:"');
  }
  
  console.log('Fingerprint baseline generated successfully.');
} catch (err) {
  console.error('Error running build-fingerprints.mjs:', err.message);
  process.exit(1);
}

// 3. Write meta.json
const metaData = {
  lastAnalyzedAt: new Date().toISOString(),
  gitCommitHash: commitHash,
  version: '1.0.0',
  analyzedFiles: sourceFilePaths.length
};
fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2), 'utf8');
console.log('Successfully wrote meta.json');

// 4. Move intermediate files to trash except scan-result.json
const timestamp = Math.floor(Date.now() / 1000);
const trashDir = path.join(projectRoot, `.understand-anything/.trash-${timestamp}`);
fs.mkdirSync(trashDir, { recursive: true });

console.log(`Moving intermediate files to trash directory: ${trashDir}`);

// Move everything in intermediate/ except scan-result.json
const filesInIntermediate = fs.readdirSync(intermediateDir);
filesInIntermediate.forEach(file => {
  if (file !== 'scan-result.json') {
    fs.renameSync(path.join(intermediateDir, file), path.join(trashDir, file));
  }
});

// Move tmp/ directory to trash/tmp
const tmpDir = path.join(projectRoot, '.understand-anything/tmp');
if (fs.existsSync(tmpDir)) {
  fs.renameSync(tmpDir, path.join(trashDir, 'tmp'));
}

console.log('Phase 7 complete.');
