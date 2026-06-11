# Hướng dẫn triển khai NexusAI lên AWS EC2 (Sử dụng DB PostgreSQL có sẵn)

Tài liệu này hướng dẫn chi tiết từng bước để triển khai hệ thống NexusAI lên máy chủ ảo AWS EC2 bằng Docker Compose và Nginx Reverse Proxy, kết nối tới cơ sở dữ liệu PostgreSQL đã có sẵn trên máy chủ (hoặc AWS RDS).

---

## 1. Chuẩn bị Máy chủ AWS EC2

### 1.1 Khởi tạo EC2 Instance
1. Đăng nhập vào **AWS Console** và chuyển đến dịch vụ **EC2**.
2. Nhấp chọn **Launch Instance**.
3. Cấu hình máy chủ:
   - **Name**: `nexusai-server`
   - **OS (AMI)**: **Ubuntu Server 22.04 LTS** hoặc **Ubuntu Server 24.04 LTS**.
   - **Instance Type**: Tối thiểu `t3.medium` (2 vCPUs, 4GB RAM) để đảm bảo NestJS & Next.js chạy mượt mà.
   - **Key Pair**: Chọn hoặc tạo mới để SSH vào máy chủ.
4. **Network Settings**:
   - Chọn hoặc tạo mới Security Group mở các cổng (Inbound Rules):
     - **Allow SSH traffic** (Cổng 22) từ IP của bạn hoặc Anywhere.
     - **Allow HTTPS traffic** (Cổng 443) từ Anywhere.
     - **Allow HTTP traffic** (Cổng 80) từ Anywhere.
     - (Tùy chọn) **Allow PostgreSQL traffic** (Cổng 5432) nếu DB PostgreSQL nằm ở server khác và cần kết nối từ ngoài.

### 1.2 Trỏ Tên miền (Domain Name)
1. Lấy **Public IPv4** của instance vừa tạo.
2. Tại trang quản lý tên miền (Cloudflare, GoDaddy, v.v.), tạo bản ghi **A Record** trỏ về địa chỉ IP của EC2:
   - `nexusai.yourdomain.com` -> `IP_PUBLIC_EC2`

---

## 2. Cài đặt Docker & Docker Compose trên EC2

SSH vào máy chủ EC2:
```bash
ssh -i "your-key.pem" ubuntu@IP_PUBLIC_EC2
```

Chạy script cài đặt nhanh Docker và Docker Compose:
```bash
# Cập nhật package list và cài đặt công cụ cần thiết
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Thêm khóa GPG của Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Thiết lập repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài đặt Docker Engine & Docker Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Khởi động Docker
sudo systemctl start docker
sudo systemctl enable docker

# Thêm user ubuntu vào nhóm docker
sudo usermod -aG docker ubuntu
```
*Lưu ý: Sau khi chạy lệnh `usermod`, bạn cần thoát SSH ra (`exit`) và đăng nhập lại để thay đổi có hiệu lực mà không cần dùng `sudo` khi gọi lệnh docker.*

---

## 3. Cấu hình Kết nối PostgreSQL đã có sẵn

Vì ứng dụng chạy trong Docker container, việc kết nối tới PostgreSQL đã cài đặt sẵn ngoài Docker sẽ khác so với thông thường:

### Trường hợp A: PostgreSQL chạy trực tiếp trên máy chủ EC2 (Localhost)
1. Trong file `docker-compose.yml`, chúng tôi đã cấu hình `extra_hosts` map `host.docker.internal` tới gateway của Docker.
2. Trong file `.env`, bạn sẽ kết nối tới DB bằng:
   ```env
   DATABASE_URL="postgresql://db_user:db_password@host.docker.internal:5432/nexusai"
   ```
3. **Quan trọng**: Cần cấu hình PostgreSQL trên EC2 để nhận kết nối từ IP của Docker container:
   - Mở file cấu hình Postgres `postgresql.conf` (thường ở `/etc/postgresql/.../main/postgresql.conf`):
     ```bash
     sudo nano /etc/postgresql/16/main/postgresql.conf
     ```
     Sửa dòng `listen_addresses` để cho phép nghe tất cả IP (hoặc IP docker):
     ```ini
     listen_addresses = '*'
     ```
   - Mở file phân quyền `pg_hba.conf` trong cùng thư mục:
     ```bash
     sudo nano /etc/postgresql/16/main/pg_hba.conf
     ```
     Thêm dòng sau vào cuối file để cho phép subnet của Docker (thường là `172.17.0.0/16` hoặc `172.18.0.0/16`, an toàn nhất là cho phép dải docker):
     ```text
     host    all             all             172.17.0.0/16           scram-sha-256
     host    all             all             172.18.0.0/16           scram-sha-256
     ```
   - Khởi động lại dịch vụ PostgreSQL:
     ```bash
     sudo systemctl restart postgresql
     ```

### Trường hợp B: PostgreSQL chạy trên dịch vụ bên ngoài (AWS RDS, Supabase, v.v.)
Trong file `.env`, bạn chỉ cần khai báo địa chỉ host/IP Public hoặc DNS của RDS:
```env
DATABASE_URL="postgresql://db_user:db_password@rds-endpoint.amazonaws.com:5432/nexusai"
```
*Hãy đảm bảo AWS RDS Security Group đã cho phép Inbound connection từ IP của EC2.*

---

## 4. Clone source code và Cấu hình Môi trường

### 4.1 Clone Project
```bash
git clone https://github.com/<your-username>/NexusAI.git
cd NexusAI
```

### 4.2 Tạo file `.env` cấu hình
Tạo file `.env` tại thư mục gốc:
```bash
nano .env
```

Nội dung file `.env` mẫu dành cho production (sử dụng DB có sẵn):
```env
# Database Connection (Ví dụ sử dụng PostgreSQL cài trực tiếp trên EC2)
DATABASE_URL="postgresql://postgres:your_password@host.docker.internal:5432/nexusai"

# JWT configuration
JWT_SECRET=your_super_secure_jwt_secret_key
JWT_EXPIRES_IN=7d

# AI Engine (Gemma hoặc OpenAI-compatible API)
AI_API_BASE=https://api.ai-box.vn/v1
AI_API_KEY=your_ai_api_key_here
AI_MODEL=deepseek-v4-flash[1m]

# AWS S3 Storage (Cho upload ảnh)
S3_ACCESS_KEY_ID=your_aws_s3_access_key_id_here
S3_SECRET_ACCESS_KEY=your_aws_s3_secret_access_key_here
S3_REGION=ap-southeast-1
S3_BUCKET_NAME=your_s3_bucket_name_here
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
S3_PUBLIC_URL=https://your_s3_bucket_name_here.s3.ap-southeast-1.amazonaws.com

# URL Frontend & Backend
# Đổi nexusai.yourdomain.com thành tên miền thực tế của bạn
FRONTEND_URL=https://nexusai.yourdomain.com
NEXT_PUBLIC_API_URL=https://nexusai.yourdomain.com/api
```

---

## 5. Build và Khởi chạy ứng dụng

### 5.1 Khởi chạy ban đầu (HTTP)
```bash
# Thực hiện build và chạy container ngầm
docker compose up --build -d
```
Docker sẽ tiến hành build image NestJS Backend và Next.js Frontend. Quá trình build của backend sẽ chạy lệnh `npx prisma migrate deploy` để tự động cập nhật cơ sở dữ liệu PostgreSQL của bạn.

### 5.2 Seed dữ liệu mẫu (Chỉ chạy lần đầu tiên nếu DB trống)
```bash
docker exec -it nexusai-backend npx prisma db seed
```

Kiểm tra xem các container đã hoạt động bình thường chưa:
```bash
docker compose ps
```

---

## 6. Thiết lập HTTPS (SSL) miễn phí với Let's Encrypt

### 6.1 Cập nhật tên miền cho Nginx
Cập nhật file `nginx/default.conf` trên máy chủ:
```bash
nano nginx/default.conf
```
Thay thế dòng `server_name localhost;` bằng tên miền của bạn:
```nginx
server_name nexusai.yourdomain.com;
```

Khởi động lại Nginx:
```bash
docker compose restart nginx
```

### 6.2 Cấp chứng chỉ SSL
Chạy lệnh Certbot (thay đổi email và domain tương ứng):
```bash
docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email admin@yourdomain.com --agree-tos --no-eff-email -d nexusai.yourdomain.com
```

### 6.3 Chuyển đổi Nginx sang HTTPS hoàn chỉnh
Mở lại cấu hình Nginx:
```bash
nano nginx/default.conf
```

Thay thế toàn bộ nội dung bằng cấu hình HTTPS:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name nexusai.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nexusai.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/nexusai.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexusai.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    # API Backend proxy pass
    location /api {
        proxy_pass http://backend:4000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        client_max_body_size 10M;
    }

    # Next.js Frontend proxy pass
    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Áp dụng cấu hình Nginx mới:
```bash
docker compose restart nginx
```

Hệ thống đã sẵn sàng tại địa chỉ `https://nexusai.yourdomain.com`.
