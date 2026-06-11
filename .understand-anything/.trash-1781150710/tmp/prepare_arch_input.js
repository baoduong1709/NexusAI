const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Project/NexusAI';
const graphPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const outputPath = path.join(projectRoot, '.understand-anything/tmp/ua-arch-input.json');

console.log(`Reading assembled graph from ${graphPath}...`);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const fileLevelTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);

// Filter file-level nodes
const fileNodes = graph.nodes
  .filter(n => fileLevelTypes.has(n.type))
  .map(n => ({
    id: n.id,
    type: n.type,
    name: n.name,
    filePath: n.filePath,
    summary: n.summary,
    tags: n.tags
  }));

// Filter import edges
const importEdges = graph.edges
  .filter(e => e.type === 'imports' && fileLevelTypes.has(e.source.split(':')[0]) && fileLevelTypes.has(e.target.split(':')[0]));

// Filter all edges (only between file-level nodes)
const allEdges = graph.edges
  .filter(e => fileLevelTypes.has(e.source.split(':')[0]) && fileLevelTypes.has(e.target.split(':')[0]));

const inputData = {
  fileNodes: fileNodes,
  importEdges: importEdges,
  allEdges: allEdges
};

fs.writeFileSync(outputPath, JSON.stringify(inputData, null, 2), 'utf8');
console.log(`Successfully prepared architecture input: ${fileNodes.length} file nodes, ${importEdges.length} import edges, ${allEdges.length} all edges.`);
