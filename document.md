# Project Specification: AI-Powered Project & Resource Management System

## 1. Giới thiệu tổng quan
Hệ thống quản lý dự án và nhân sự thế hệ mới, tích hợp trí tuệ nhân tạo (AI) để tối ưu hóa quy trình từ khâu tiếp nhận yêu cầu (Requirement) đến khâu phân bổ công việc (Task Assignment).

## 2. Mục tiêu hệ thống
- Chuẩn hóa quy trình quản lý nhân sự và dự án trong công ty.
- Tự động hóa việc phân tích tài liệu và tạo task bằng AI.
- Quản lý tập trung tài liệu dự án và quyền truy cập của nhân viên.

## 3. Các tính năng chính (Core Features)

### 3.1. Quản lý Nhân sự & Phân quyền (RBAC)
- **Quản lý User:** Thêm, sửa, xóa và quản lý trạng thái hoạt động của nhân viên.
- **Hệ thống Role tùy chỉnh:** Admin có thể tạo các vai trò (ví dụ: PM, Lead, Developer, Designer, Tester).
- **Phân quyền chi tiết:** Gán các quyền cụ thể (Permissions) cho từng Role (Ví dụ: Chỉ Lead mới có quyền duyệt task từ AI).

### 3.2. Quản lý Dự án (Project Management)
- **Tạo dự án:** Thiết lập tên dự án, thời gian dự kiến và ngân sách.
- **Phân bổ nhân sự:** Một nhân viên có thể tham gia cùng lúc nhiều dự án (Quan hệ N-N).
- **Thư mục tài liệu (Documents):** Mỗi dự án tự động có một không gian lưu trữ riêng để chứa các file Requirement (.pdf, .docx, .txt).

### 3.3. Tích hợp AI (AI Automation)
- **Tổng hợp Requirement:** AI (Gemma 4 31B) đọc tài liệu trong thư mục dự án và tóm tắt các điểm chính.
- **Tự động tạo Task:** AI đề xuất danh sách công việc dựa trên nội dung tài liệu.
- **Smart Suggestion:** Gợi ý nhân viên phù hợp để gán task dựa trên kỹ năng hoặc vai trò.

## 4. Kiến trúc kỹ thuật (Technical Stack)

| Thành phần | Công nghệ |
| :--- | :--- |
| **Frontend** | Next.js 14+, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js (NestJS) |
| **Database** | PostgreSQL |
| **ORM** | Prisma hoặc TypeORM |
| **AI Engine** | Gemma 4 31B (thông qua API hoặc Self-hosted) |
| **Storage** | AWS S3 hoặc Supabase Storage |

## 5. Cấu trúc dữ liệu cơ bản (Database Schema)

1. **Users:** `id, name, email, password, role_id, created_at`
2. **Roles:** `id, name, permissions (JSONB)`
3. **Projects:** `id, name, description, document_path, start_date, end_date`
4. **Project_Members:** `project_id, user_id` (Bảng trung gian)
5. **Tasks:** `id, project_id, title, description, assignee_id, status, priority, is_ai_generated`

## 6. Luồng nghiệp vụ (Workflow)

1. **Bước 1:** Admin thiết lập hệ thống nhân viên và các Role tương ứng.
2. **Bước 2:** PM tạo dự án và upload các file tài liệu vào thư mục của dự án đó.
3. **Bước 3:** PM/Lead chọn tính năng "AI Analysis". AI sẽ quét tài liệu và hiển thị bảng tóm tắt cùng danh sách task dự kiến.
4. **Bước 4:** PM/Lead chỉnh sửa và nhấn "Confirm". Hệ thống sẽ chính thức gán task vào bảng điều khiển của nhân viên.
5. **Bước 5:** Nhân viên cập nhật trạng thái công việc (To Do -> In Progress -> Done).

---
*Tài liệu này được soạn thảo cho mục đích phát triển nội bộ công ty.*