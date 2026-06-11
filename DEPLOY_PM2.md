# Hướng dẫn triển khai NexusAI bằng PM2 (Không dùng Docker)

Tài liệu này hướng dẫn chạy dự án NexusAI trực tiếp trên hệ điều hành của máy chủ bằng **PM2** thay thế cho Docker. 

Khi chạy bằng PM2 trực tiếp trên host:
- Bạn dễ dàng quản lý log bằng lệnh `pm2 logs`.
- Kết nối PostgreSQL sử dụng cổng `localhost` bình thường.
- Hiệu năng tối ưu hơn đối với các máy chủ EC2 cấu hình thấp.

---

## 1. Cài đặt các công cụ cần thiết trên Server

Đăng nhập vào EC2 và cài đặt Node.js, PM2 (nếu chưa có):

```bash
# 1. Cài đặt PM2 toàn cục
sudo npm install -g pm2
```

---

## 2. Cấu hình file `.env` tại thư mục gốc của dự án

Khi chạy trực tiếp trên máy chủ (không dùng Docker), bạn cần chuyển kết nối Database quay về `localhost`:

Mở file `.env` ở thư mục `/var/www/baoduong.dev/NexusAI/.env`:
```bash
nano .env
```

Cập nhật lại các dòng cấu hình sau:
```env
# Database Connection (Dùng localhost vì ứng dụng và DB chạy chung trên host)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexusai"

# Các cấu hình JWT, AI Engine, S3 giữ nguyên...
JWT_SECRET="bao1709"
JWT_EXPIRES_IN="7d"
AI_API_BASE="https://api.ai-box.vn/v1"
AI_API_KEY="sk-1O6r1xOga2yJzGzMxm8bqVbtsVXt8i8JaukGhHiA37BZb43L"
AI_MODEL="deepseek-v4-flash[1m]"

# URL cấu hình subdomain
FRONTEND_URL=https://nexusai.baoduong.dev
NEXT_PUBLIC_API_URL=https://api.nexusai.baoduong.dev/api
```

---

## 3. Khởi chạy NestJS Backend bằng PM2

Truy cập thư mục backend, cài đặt thư viện, build dự án và chạy bằng PM2:

```bash
cd /var/www/baoduong.dev/NexusAI/backend

# 1. Cài đặt các thư viện dependencies
npm install

# 2. Sinh Prisma Client và chạy migration cập nhật database
npx prisma generate
npx prisma migrate deploy

# 3. Biên dịch mã nguồn TypeScript sang JavaScript
npm run build

# 4. Khởi chạy Backend bằng PM2
pm2 start dist/src/main.js --name "nexusai-backend"
```

---

## 4. Khởi chạy Next.js Frontend bằng PM2

Truy cập thư mục frontend, cài đặt, build dự án và khởi chạy:

```bash
cd /var/www/baoduong.dev/NexusAI/frontend

# 1. Cài đặt dependencies
npm install

# 2. Biên dịch Next.js sang chế độ Production
# Next.js sẽ tự động lấy NEXT_PUBLIC_API_URL từ file .env ở thư mục gốc của dự án
npm run build

# 3. Khởi chạy Frontend bằng PM2
pm2 start npm --name "nexusai-frontend" -- start
```

---

## 5. Quản lý ứng dụng và xem logs với PM2

Sau khi khởi chạy thành công cả 2 dịch vụ, bạn có thể sử dụng các lệnh PM2 sau:

- **Xem danh sách tiến trình đang chạy:**
  ```bash
  pm2 list
  ```
  *(Bạn sẽ thấy 2 tiến trình `nexusai-backend` và `nexusai-frontend` hiển thị trạng thái `online`).*

- **Xem logs thời gian thực (real-time logs) để debug lỗi:**
  ```bash
  pm2 logs
  ```
  hoặc xem cụ thể log của backend để xem lỗi DB/API:
  ```bash
  pm2 logs nexusai-backend
  ```

- **Khởi động lại dịch vụ khi thay đổi code hoặc cấu hình:**
  ```bash
  pm2 restart nexusai-backend
  pm2 restart nexusai-frontend
  ```

- **Cấu hình tự khởi động PM2 cùng hệ thống (khi EC2 bị reboot):**
  ```bash
  pm2 startup
  # Chạy lệnh sudo env... được PM2 sinh ra trên màn hình terminal của bạn
  pm2 save
  ```
