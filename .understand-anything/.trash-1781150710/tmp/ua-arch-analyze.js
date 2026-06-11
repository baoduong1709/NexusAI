const fs = require('fs');
const path = require('path');

// Get arguments
const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node ua-arch-analyze.js <input-path> <output-path>');
  process.exit(1);
}

// Read input JSON
let data;
try {
  const content = fs.readFileSync(inputPath, 'utf8');
  data = JSON.parse(content);
} catch (error) {
  console.error('Error reading/parsing input file:', error);
  process.exit(1);
}

const fileNodes = data.fileNodes || [];
const importEdges = data.importEdges || [];
const allEdges = data.allEdges || [];

// Helper to get directory path at different levels
function getDirAtLevel(filePath, level = 1) {
  if (!filePath) return 'root';
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= level) {
    return parts.slice(0, parts.length - 1).join('/') || 'root';
  }
  return parts.slice(0, level).join('/');
}

// Helper to get file extension/type
function getFileExtension(filePath) {
  if (!filePath) return '';
  return path.extname(filePath).toLowerCase();
}

// 1. Directory groups
const dirGroups = {};
fileNodes.forEach(node => {
  const fp = node.filePath || '';
  const dir1 = getDirAtLevel(fp, 1);
  const dir2 = getDirAtLevel(fp, 2);
  
  if (!dirGroups[dir1]) {
    dirGroups[dir1] = { name: dir1, nodes: [], subdirs: {} };
  }
  dirGroups[dir1].nodes.push(node.id);
  
  if (!dirGroups[dir1].subdirs[dir2]) {
    dirGroups[dir1].subdirs[dir2] = [];
  }
  dirGroups[dir1].subdirs[dir2].push(node.id);
});

// 2. Node type groups
const nodeTypeGroups = {};
fileNodes.forEach(node => {
  const type = node.type || 'unknown';
  if (!nodeTypeGroups[type]) {
    nodeTypeGroups[type] = [];
  }
  nodeTypeGroups[type].push(node.id);
});

// Map node ID to its metadata for quick lookup
const nodeMap = new Map();
fileNodes.forEach(node => {
  nodeMap.set(node.id, node);
});

// 3. Import adjacency matrix (adjacency list)
const importAdjacency = {};
fileNodes.forEach(node => {
  importAdjacency[node.id] = { imports: [], importedBy: [] };
});

importEdges.forEach(edge => {
  const { source, target } = edge;
  if (importAdjacency[source]) {
    importAdjacency[source].imports.push(target);
  }
  if (importAdjacency[target]) {
    importAdjacency[target].importedBy.push(source);
  }
});

// 4. Cross-category dependency analysis
const crossCategoryDeps = {};
allEdges.forEach(edge => {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  if (sourceNode && targetNode) {
    const sCat = sourceNode.type;
    const tCat = targetNode.type;
    const relType = edge.type;
    
    const key = `${sCat}->${tCat}`;
    if (!crossCategoryDeps[key]) {
      crossCategoryDeps[key] = { count: 0, relations: new Set() };
    }
    crossCategoryDeps[key].count++;
    crossCategoryDeps[key].relations.add(relType);
  }
});

// Convert relations sets to arrays for JSON serialization
Object.keys(crossCategoryDeps).forEach(key => {
  crossCategoryDeps[key].relations = Array.from(crossCategoryDeps[key].relations);
});

// 5 & 6. Inter-group import frequency and Intra-group density
const groupKeys = Object.keys(dirGroups);
const interGroupImports = {};
const intraGroupImports = {};

groupKeys.forEach(g1 => {
  intraGroupImports[g1] = 0;
  groupKeys.forEach(g2 => {
    if (g1 !== g2) {
      interGroupImports[`${g1}->${g2}`] = 0;
    }
  });
});

importEdges.forEach(edge => {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  if (sourceNode && targetNode) {
    const gSource = getDirAtLevel(sourceNode.filePath, 1);
    const gTarget = getDirAtLevel(targetNode.filePath, 1);
    
    if (gSource === gTarget) {
      if (intraGroupImports[gSource] !== undefined) {
        intraGroupImports[gSource]++;
      }
    } else {
      const key = `${gSource}->${gTarget}`;
      if (interGroupImports[key] !== undefined) {
        interGroupImports[key]++;
      }
    }
  }
});

const intraGroupDensity = {};
groupKeys.forEach(g => {
  const nodeCount = dirGroups[g].nodes.length;
  const importsCount = intraGroupImports[g] || 0;
  const maxPossibleEdges = nodeCount * (nodeCount - 1);
  intraGroupDensity[g] = {
    nodeCount,
    importsCount,
    density: maxPossibleEdges > 0 ? (importsCount / maxPossibleEdges) : 0
  };
});

// 7. Pattern matches
const patternMatches = {
  nestjsController: [],
  nestjsService: [],
  nestjsModule: [],
  reactComponent: [],
  reactPage: [],
  reactLayout: [],
  unitTest: [],
  configFiles: [],
  dtoSchema: [],
  databaseModel: []
};

fileNodes.forEach(node => {
  const fp = node.filePath || '';
  const name = node.name || '';
  
  if (name.endsWith('.controller.ts')) {
    patternMatches.nestjsController.push(node.id);
  } else if (name.endsWith('.service.ts')) {
    patternMatches.nestjsService.push(node.id);
  } else if (name.endsWith('.module.ts')) {
    patternMatches.nestjsModule.push(node.id);
  } else if (name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name.endsWith('.spec.ts') || name.endsWith('.spec.tsx')) {
    patternMatches.unitTest.push(node.id);
  } else if (fp.includes('frontend/components/')) {
    patternMatches.reactComponent.push(node.id);
  } else if (fp.includes('frontend/app/') && name.endsWith('page.tsx')) {
    patternMatches.reactPage.push(node.id);
  } else if (fp.includes('frontend/app/') && name.endsWith('layout.tsx')) {
    patternMatches.reactLayout.push(node.id);
  } else if (fp.includes('dto/')) {
    patternMatches.dtoSchema.push(node.id);
  } else if (fp.includes('prisma/') || name.endsWith('.prisma') || fp.includes('schema')) {
    patternMatches.databaseModel.push(node.id);
  }
  
  // Config files
  const configNames = [
    'package.json', 'tsconfig.json', 'docker-compose.yml', 'Dockerfile',
    'tailwind.config.ts', 'tailwind.config.js', 'next.config.ts',
    'next.config.js', 'next.config.mjs', '.gitignore', '.understandignore'
  ];
  if (configNames.includes(name) || name.startsWith('.env')) {
    patternMatches.configFiles.push(node.id);
  }
});

// 8. Deployment topology
const deploymentTopology = {
  dockerConfigs: [],
  packageManifests: [],
  envConfigs: []
};
fileNodes.forEach(node => {
  const name = (node.name || '').toLowerCase();
  if (name.includes('docker') || name.includes('compose')) {
    deploymentTopology.dockerConfigs.push(node.id);
  } else if (name === 'package.json') {
    deploymentTopology.packageManifests.push(node.id);
  } else if (name.startsWith('.env')) {
    deploymentTopology.envConfigs.push(node.id);
  }
});

// 9. Data pipeline (prisma, migrations, schema definition, services communicating with db)
const dataPipeline = {
  dbServiceNodes: [],
  dbSchemaNodes: [],
  dataTransferObjects: []
};
fileNodes.forEach(node => {
  const fp = node.filePath || '';
  if (fp.includes('prisma') || fp.includes('database')) {
    dataPipeline.dbSchemaNodes.push(node.id);
  }
  if (node.tags && (node.tags.includes('database') || node.tags.includes('prisma'))) {
    dataPipeline.dbServiceNodes.push(node.id);
  }
  if (fp.includes('dto/')) {
    dataPipeline.dataTransferObjects.push(node.id);
  }
});

// 10. Doc coverage
const docNodes = fileNodes.filter(n => n.type === 'document' || (n.filePath || '').endsWith('.md') || (n.filePath || '').endsWith('.txt'));
const totalFilesCount = fileNodes.length;
const docCoverage = {
  totalFiles: totalFilesCount,
  docFilesCount: docNodes.length,
  ratio: totalFilesCount > 0 ? (docNodes.length / totalFilesCount) : 0,
  documents: docNodes.map(n => n.id)
};

// 11. Dependency Direction (Detect cycles and standard direction frontend -> backend check)
const visited = {};
const recStack = {};
const cycles = [];

function detectCyclesHelper(nodeId, adjList) {
  visited[nodeId] = true;
  recStack[nodeId] = true;
  
  const neighbors = adjList[nodeId] ? adjList[nodeId].imports : [];
  for (const neighbor of neighbors) {
    if (!visited[neighbor]) {
      if (detectCyclesHelper(neighbor, adjList)) {
        cycles.push({ source: nodeId, target: neighbor });
        return true;
      }
    } else if (recStack[neighbor]) {
      cycles.push({ source: nodeId, target: neighbor });
      return true;
    }
  }
  
  recStack[nodeId] = false;
  return false;
}

fileNodes.forEach(node => {
  if (!visited[node.id]) {
    detectCyclesHelper(node.id, importAdjacency);
  }
});

const crossBoundaryViolations = [];
importEdges.forEach(edge => {
  const { source, target } = edge;
  const sourceNode = nodeMap.get(source);
  const targetNode = nodeMap.get(target);
  if (sourceNode && targetNode && sourceNode.filePath && targetNode.filePath) {
    if (sourceNode.filePath.includes('backend/') && targetNode.filePath.includes('frontend/')) {
      crossBoundaryViolations.push({ source, target, type: 'backend-imports-frontend' });
    }
  }
});

const dependencyDirection = {
  detectedCyclesCount: cycles.length,
  cycles: cycles.slice(0, 10),
  crossBoundaryViolations
};

// Compose final results JSON
const results = {
  directoryGroups: dirGroups,
  nodeTypeGroups: nodeTypeGroups,
  importAdjacencyMatrix: importAdjacency,
  crossCategoryDependencyAnalysis: crossCategoryDeps,
  interGroupImportFrequency: interGroupImports,
  intraGroupDensity: intraGroupDensity,
  patternMatches: patternMatches,
  deploymentTopology: deploymentTopology,
  dataPipeline: dataPipeline,
  docCoverage: docCoverage,
  dependencyDirection: dependencyDirection
};

// Write results to file
try {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('Successfully completed structural analysis. Results written to', outputPath);
} catch (error) {
  console.error('Error writing results to file:', error);
  process.exit(1);
}
