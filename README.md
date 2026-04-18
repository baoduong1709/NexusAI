# NexusAI - AI-Powered Project & Resource Management System

## Tổng quan
Hệ thống quản lý dự án và nhân sự tích hợp AI, sử dụng Gemma để phân tích tài liệu và tự động tạo task.

## Tech Stack
- **Frontend:** Next.js 14, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend:** NestJS, Prisma ORM
- **Database:** PostgreSQL
- **AI:** Gemma via Google AI API (OpenAI-compatible)

## Cấu trúc dự án
```
NexusAI/
├── backend/          # NestJS API (port 4000)
│   ├── src/
│   │   ├── auth/     # JWT Authentication
│   │   ├── users/    # User management
│   │   ├── roles/    # RBAC Roles & Permissions
│   │   ├── projects/ # Project management
│   │   ├── tasks/    # Task management
│   │   ├── documents/# File upload
│   │   └── ai/       # Gemma AI integration
│   └── prisma/       # Schema & seed
└── frontend/         # Next.js app (port 3000)
    ├── app/
    │   ├── (auth)/   # Login page
    │   └── (dashboard)/
    │       ├── dashboard/
    │       ├── users/
    │       ├── roles/
    │       └── projects/[id]/ai-analysis/
    └── lib/          # API client, auth context
```

## Cài đặt và chạy

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Google AI API key (cho Gemma)

### Backend
```bash
cd backend
npm install

# Copy env file và điền thông tin
cp .env.example .env
# Sửa DATABASE_URL, AI_API_KEY trong .env

# Tạo database và migrate
npx prisma migrate dev --name init
npx prisma generate

# Seed dữ liệu mẫu
npx ts-node prisma/seed.ts

# Chạy server
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install

# Chạy
npm run dev
```

### Truy cập
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- Swagger Docs: http://localhost:4000/api/docs

### Tài khoản mặc định
- **Email:** admin@nexusai.com
- **Mật khẩu:** Admin@123

## API Endpoints

### Auth
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy thông tin user

### Users
- `GET /api/users` - Danh sách nhân viên
- `POST /api/users` - Tạo nhân viên
- `PUT /api/users/:id` - Cập nhật
- `DELETE /api/users/:id` - Xóa

### Roles
- `GET /api/roles` - Danh sách vai trò
- `GET /api/roles/permissions` - Danh sách quyền
- `POST /api/roles` - Tạo vai trò

### Projects
- `GET /api/projects` - Danh sách dự án
- `POST /api/projects` - Tạo dự án
- `GET /api/projects/:id` - Chi tiết dự án
- `POST /api/projects/:id/members/:userId` - Thêm thành viên

### Tasks
- `GET /api/projects/:projectId/tasks` - Danh sách tasks
- `POST /api/projects/:projectId/tasks` - Tạo task
- `PATCH /api/projects/:projectId/tasks/:id/status` - Cập nhật trạng thái

### Documents
- `POST /api/projects/:projectId/documents/upload` - Upload tài liệu
- `GET /api/projects/:projectId/documents` - Danh sách tài liệu

### AI
- `GET /api/projects/:projectId/ai/analyze` - Phân tích dự án
- `POST /api/projects/:projectId/ai/confirm-tasks` - Xác nhận tạo tasks
- `POST /api/projects/:projectId/ai/suggest-assignee` - Gợi ý nhân viên

## Luồng sử dụng AI
1. PM tạo dự án và upload tài liệu (PDF, DOCX, TXT)
2. PM/Lead vào trang **AI Analysis**
3. Click **Bắt đầu phân tích AI** → Gemma đọc tài liệu và đề xuất tasks
4. Review, chỉnh sửa tasks và gán nhân viên
5. Click **Xác nhận** → Tasks được tạo trong hệ thống
