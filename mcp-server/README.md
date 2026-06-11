# NexusAI MCP Server (API & User Token driven)

Đây là MCP (Model Context Protocol) Server dùng để kết nối AI local với hệ thống quản lý dự án **NexusAI** thông qua API REST.

Hệ thống hỗ trợ phân quyền người dùng (RBAC). Mọi tác vụ đọc dự án, task, tài liệu của AI sẽ được thực hiện bằng **quyền hạn của chính tài khoản user** cấu hình token, thay vì sử dụng tài khoản Admin chung.

## Các công cụ được cung cấp (Tools)

1. `list_projects`: Liệt kê các dự án mà tài khoản user hiện tại được quyền truy cập.
2. `get_project_details`: Lấy thông tin chi tiết của dự án (số thành viên, thống kê trạng thái task).
3. `list_tasks`: Xem danh sách công việc của dự án (có thể lọc theo trạng thái).
4. `list_documents`: Xem danh sách file tài liệu/requirements của dự án.
5. `read_document`: Đọc nội dung file text (Markdown, TXT, JSON,...) của tài liệu dựa trên `projectId` và `documentId`.

---

## Cấu hình Token của User

Mở file [.env](file:///c:/Project/NexusAI/mcp-server/.env) ở thư mục `mcp-server` local của bạn:

```env
BACKEND_URL="http://localhost:4000"
NEXUS_API_TOKEN="dán_token_jwt_của_bạn_vào_đây"
```

### Cách lấy JWT Token của bạn từ Web App:
Để lấy Token cá nhân khi bạn đã đăng nhập thành công vào trang quản lý NexusAI trên trình duyệt:

1. Mở trang quản lý của bạn (ví dụ: `http://localhost:3000` hoặc trang đã deploy).
2. Đăng nhập vào tài khoản của bạn.
3. Nhấn phím `F12` (hoặc chuột phải -> **Inspect**) để mở Developer Tools trên trình duyệt.
4. Chuyển qua tab **Application** (trên Chrome/Edge) hoặc **Storage** (trên Firefox).
5. Trong menu bên trái, tìm mục **Local Storage** -> Chọn địa chỉ trang web của bạn (ví dụ `http://localhost:3000`).
6. Tìm key tên là `nexus_auth_token` hoặc `token` (hoặc kiểm tra tab **Network** -> xem các request gửi lên backend, copy chuỗi token trong phần header `Authorization: Bearer <token>`).
7. Copy chuỗi token đó và dán vào biến `NEXUS_API_TOKEN` trong file `.env`.

---

## Cách Cấu Hình Khi Deploy Lên Server (Production)

Khi deploy hệ thống lên server:
1. Bạn chỉ cần sửa `BACKEND_URL` trong file `.env` ở máy local của bạn thành URL server thật:
   ```env
   BACKEND_URL="https://api.yourdomain.com"
   ```
2. Mỗi nhân viên/user trong công ty muốn sử dụng AI ở máy local của họ để kết nối lên server công ty chỉ cần:
   - Tải thư mục `mcp-server` này về máy của họ.
   - Sửa file `.env` trỏ đến `BACKEND_URL` của công ty.
   - Lấy JWT Token từ tài khoản của chính họ trên trình duyệt và điền vào `NEXUS_API_TOKEN`.
   - Cấu hình MCP trên Cursor/Claude Desktop của họ.
   
*Khi đó, AI của mỗi người sẽ hoạt động với chính xác quyền hạn (Role/Permissions) của người đó trên hệ thống (ví dụ: Tester chỉ đọc được task test, Lead mới được duyệt task).*

---

## Khởi chạy ở máy local

Nếu chưa chạy, bạn hãy mở terminal tại thư mục này và chạy:
```bash
npm install
```

Sau đó đăng ký với Cursor IDE hoặc Claude Desktop như hướng dẫn trong file cấu hình local process.
