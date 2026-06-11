const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Project/NexusAI';
const graphPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const layersPath = path.join(projectRoot, '.understand-anything/intermediate/layers.json');
const outputPath = path.join(projectRoot, '.understand-anything/tmp/ua-tour-input.json');

console.log(`Reading assembled graph from ${graphPath}...`);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

console.log(`Reading layers from ${layersPath}...`);
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));

// Format layers to omit nodeIds
const tourLayers = layers.map(l => ({
  id: l.id,
  name: l.name,
  description: l.description
}));

const inputData = {
  nodes: graph.nodes,
  edges: graph.edges,
  layers: tourLayers
};

fs.writeFileSync(outputPath, JSON.stringify(inputData, null, 2), 'utf8');
console.log(`Successfully prepared tour input: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${tourLayers.length} layers.`);
