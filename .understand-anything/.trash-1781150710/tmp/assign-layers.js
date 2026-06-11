const fs = require('fs');
const path = require('path');

const inputPath = 'c:/Project/NexusAI/.understand-anything/tmp/ua-arch-input.json';
const content = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(content);

const fileNodes = data.fileNodes || [];
console.log('Total input nodes to process:', fileNodes.length);

const layers = {
  'layer:ui': {
    id: 'layer:ui',
    name: 'Lớp Giao diện Người dùng (UI Layer)',
    description: 'Chứa các thành phần giao diện, trang (pages), layouts, providers và tài nguyên CSS của ứng dụng Next.js frontend.',
    nodeIds: []
  },
  'layer:api-routing': {
    id: 'layer:api-routing',
    name: 'Lớp Điều phối & API (API & Routing Layer)',
    description: 'Quản lý các điểm cuối API (Endpoints), các bộ điều phối (Controllers) trong NestJS và API client tương tác ở phía frontend.',
    nodeIds: []
  },
  'layer:business-logic': {
    id: 'layer:business-logic',
    name: 'Lớp Nghiệp vụ & Dịch vụ (Business Logic & Service Layer)',
    description: 'Chứa các logic nghiệp vụ cốt lõi, NestJS modules, các dịch vụ AI/RAG, quản lý quyền truy cập, bảo mật, và các tiện ích dùng chung.',
    nodeIds: []
  },
  'layer:data-access': {
    id: 'layer:data-access',
    name: 'Lớp Dữ liệu & Truy cập Dữ liệu (Database & Data Model Layer)',
    description: 'Định nghĩa cơ sở dữ liệu Prisma schema, các tệp migration SQL, DTOs để kiểm định dữ liệu, các bảng dữ liệu (Tables) và PrismaService truy cập dữ liệu.',
    nodeIds: []
  },
  'layer:testing': {
    id: 'layer:testing',
    name: 'Lớp Kiểm thử (Testing Layer)',
    description: 'Chứa các ca kiểm thử đơn vị (unit tests), kiểm thử tích hợp và các script đánh giá hiệu năng/chất lượng của tác vụ AI agent.',
    nodeIds: []
  },
  'layer:infrastructure-config': {
    id: 'layer:infrastructure-config',
    name: 'Lớp Cấu hình & Hạ tầng (Infrastructure & Configuration Layer)',
    description: 'Chứa cấu hình Docker, các file .env, package.json, cấu hình TypeScript compiler (tsconfig), và các script tiện ích, bảo trì hệ thống.',
    nodeIds: []
  },
  'layer:documentation': {
    id: 'layer:documentation',
    name: 'Lớp Tài liệu (Documentation Layer)',
    description: 'Chứa các tệp tài liệu Markdown hướng dẫn kiến trúc, thiết lập dự án và chính sách chạy agent.',
    nodeIds: []
  }
};

const unclassified = [];
const nodeClassificationMap = new Map();

fileNodes.forEach(node => {
  const { id, type, filePath, name } = node;
  const fp = filePath || '';
  const nm = name || '';
  
  let assignedLayer = null;
  
  // Rule 1: Documents
  if (type === 'document' || id.startsWith('document:')) {
    assignedLayer = 'layer:documentation';
  }
  // Rule 2: Configs
  else if (type === 'config' || id.startsWith('config:')) {
    assignedLayer = 'layer:infrastructure-config';
  }
  // Rule 3: Table and Schema definitions
  else if (type === 'table' || id.startsWith('table:')) {
    assignedLayer = 'layer:data-access';
  }
  else if (id === 'schema:backend/prisma/schema.prisma') {
    assignedLayer = 'layer:data-access';
  }
  // Rule 4: Endpoints
  else if (type === 'endpoint' || id.startsWith('endpoint:')) {
    assignedLayer = 'layer:api-routing';
  }
  // Rule 5: Testing files
  else if (
    fp.includes('.test.') || 
    fp.includes('.spec.') || 
    fp.includes('backend/eval/')
  ) {
    assignedLayer = 'layer:testing';
  }
  // Rule 6: UI Layer (Frontend apps and components)
  else if (
    fp.startsWith('frontend/app/') || 
    fp.startsWith('frontend/components/') ||
    nm.endsWith('.css') ||
    fp.endsWith('.css')
  ) {
    assignedLayer = 'layer:ui';
  }
  // Rule 7: Data layer - prisma schema, seed scripts, prisma module/service, and DTOs
  else if (
    fp.includes('prisma/') ||
    fp.includes('/dto/') ||
    nm.endsWith('.dto.ts') ||
    fp.endsWith('.dto.ts') ||
    id === 'schema:backend/src/common/dto/paginated-response.ts' ||
    id === 'schema:backend/src/tasks/dto/create-task.dto.ts' ||
    id === 'service:backend/src/prisma/prisma.service.ts' ||
    id === 'file:backend/src/prisma/prisma.module.ts' ||
    id === 'file:backend/src/prisma/prisma.service.ts'
  ) {
    assignedLayer = 'layer:data-access';
  }
  // Rule 8: API layer - NestJS Controllers & Frontend API client
  else if (
    fp.includes('.controller.ts') ||
    id === 'file:frontend/lib/api.ts' ||
    id === 'service:frontend/lib/api.ts'
  ) {
    assignedLayer = 'layer:api-routing';
  }
  // Rule 9: Business Logic & Services (NestJS Services, Modules, Guards, Decorators, Utils)
  else if (
    id.startsWith('service:backend/src/') ||
    fp.includes('backend/src/ai/') || 
    fp.includes('backend/src/auth/') || 
    fp.includes('backend/src/project-ai-index/') ||
    fp.includes('backend/src/projects/') ||
    fp.includes('backend/src/roles/') ||
    fp.includes('backend/src/tasks/') ||
    fp.includes('backend/src/users/') ||
    fp.includes('backend/src/documents/') || // Documents Module, MarkitdownService, DocumentsService
    fp.includes('backend/src/common/middleware/') ||
    fp.includes('backend/src/common/storage/') ||
    fp.includes('frontend/lib/') ||
    fp.endsWith('.module.ts') ||
    fp.endsWith('main.ts') ||
    nm === 'AppModule' ||
    nm === 'main.ts' ||
    nm.endsWith('Module')
  ) {
    assignedLayer = 'layer:business-logic';
  }
  // Rule 10: Infrastructure configs / admin scripts at root levels
  else if (
    fp.startsWith('backend/') && !fp.startsWith('backend/src/') && (nm.endsWith('.js') || nm.endsWith('.ts')) ||
    fp.startsWith('frontend/') && !fp.startsWith('frontend/src/') && (nm.endsWith('.js') || nm.endsWith('.mjs') || nm.endsWith('.ts')) ||
    fp.startsWith('scratch/') ||
    fp.startsWith('.understand-anything/')
  ) {
    assignedLayer = 'layer:infrastructure-config';
  }
  
  if (assignedLayer) {
    layers[assignedLayer].nodeIds.push(id);
    nodeClassificationMap.set(id, assignedLayer);
  } else {
    unclassified.push(node);
  }
});

console.log('Unclassified nodes count:', unclassified.length);
if (unclassified.length > 0) {
  console.log('Sample unclassified:', unclassified.slice(0, 5));
}

// Statistics
let totalAssigned = 0;
Object.keys(layers).forEach(key => {
  const count = layers[key].nodeIds.length;
  totalAssigned += count;
  console.log(`Layer ${key}: ${count} nodes`);
});
console.log('Total assigned:', totalAssigned);

if (totalAssigned !== fileNodes.length) {
  console.error('ERROR: Total assigned nodes does not match total input nodes!');
  process.exit(1);
}

// Convert layers object to array
const layersArray = Object.values(layers);

// Ensure directory intermediate exists
const outDir = 'c:/Project/NexusAI/.understand-anything/intermediate';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outDir, 'layers.json'),
  JSON.stringify(layersArray, null, 2),
  'utf8'
);
console.log('Saved layers.json to intermediate directory successfully.');
