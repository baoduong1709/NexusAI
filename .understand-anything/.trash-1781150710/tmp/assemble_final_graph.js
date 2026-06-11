const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Project/NexusAI';
const scanResultPath = path.join(projectRoot, '.understand-anything/intermediate/scan-result.json');
const graphPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const layersPath = path.join(projectRoot, '.understand-anything/intermediate/layers.json');
const tourPath = path.join(projectRoot, '.understand-anything/intermediate/tour.json');
const outputGraphPath = path.join(projectRoot, '.understand-anything/intermediate/assembled-graph.json');
const commitHash = '67113e328a793bcc5853240bbabcaff1ec43dc55';

console.log('Assembling final Knowledge Graph...');

// Read inputs
const scanResult = JSON.parse(fs.readFileSync(scanResultPath, 'utf8'));
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));

// Build valid nodes set
const nodeIds = new Set(graph.nodes.map(n => n.id));

// Validate and clean layers
const cleanedLayers = layers.map(layer => {
  const validNodeIds = (layer.nodeIds || []).filter(id => {
    if (nodeIds.has(id)) return true;
    console.warn(`Layer '${layer.id}' references missing node '${id}' — removed.`);
    return false;
  });
  return {
    id: layer.id,
    name: layer.name,
    description: layer.description,
    nodeIds: validNodeIds
  };
}).filter(l => l.nodeIds.length > 0);

// Validate and clean tour steps
const cleanedTour = tour.map(step => {
  const validNodeIds = (step.nodeIds || []).filter(id => {
    if (nodeIds.has(id)) return true;
    console.warn(`Tour step ${step.order} references missing node '${id}' — removed.`);
    return false;
  });
  const cleanedStep = {
    order: step.order,
    title: step.title,
    description: step.description,
    nodeIds: validNodeIds
  };
  if (step.languageLesson) {
    cleanedStep.languageLesson = step.languageLesson;
  }
  return cleanedStep;
}).filter(s => s.nodeIds.length > 0);

// Re-index order just in case
cleanedTour.forEach((step, index) => {
  step.order = index + 1;
});

const finalGraph = {
  version: '1.0.0',
  project: {
    name: scanResult.name || 'NexusAI',
    languages: scanResult.languages || [],
    frameworks: scanResult.frameworks || [],
    description: scanResult.description || 'AI-Powered Project & Resource Management System',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: commitHash
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers: cleanedLayers,
  tour: cleanedTour
};

fs.writeFileSync(outputGraphPath, JSON.stringify(finalGraph, null, 2), 'utf8');
console.log('Successfully assembled and wrote final graph to assembled-graph.json');
