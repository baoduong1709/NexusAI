const fs = require('fs');
const path = require('path');

const graphPath = 'c:/Project/NexusAI/.understand-anything/intermediate/assembled-graph.json';
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const userNode = graph.nodes.find(n => n.id === 'table:backend/prisma/schema.prisma:User');
if (userNode) {
  userNode.tags = ['database', 'user-schema', 'table'];
  console.log('Fixed tags for table:backend/prisma/schema.prisma:User');
} else {
  console.log('Node not found!');
}

fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf8');
