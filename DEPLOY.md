# Hướng dẫn triển khai NexusAI lên AWS EC2 (Sử dụng Nginx có sẵn trên Host)

Tài liệu này hướng dẫn chi tiết từng bước để triển khai hệ thống NexusAI lên máy chủ ảo AWS EC2 bằng Docker Compose, kết nối tới cơ sở dữ liệu PostgreSQL có sẵn và sử dụng chính **Nginx đang chạy trên máy chủ** (Host) làm Reverse Proxy để tránh xung đột cổng 80/443 với các trang web hiện có (ví dụ: `baoduong.dev`).

---

## 1. Chuẩn bị Máy chủ AWS EC2

### 1.1 Cấu hình Security Group (Inbound Rules)
Đảm bảo Security Group của máy chủ EC2 đã mở các cổng:
- **Cổng 22** (SSH) để truy cập máy chủ.
- **Cổng 80** (HTTP) và **Cổng 443** (HTTPS) phục vụ website.

### 1.2 Trỏ Tên miền phụ (Subdomain)
Truy cập trang quản lý tên miền của bạn (ví dụ: Cloudflare) và tạo bản ghi **A Record** trỏ subdomain về IP của EC2:
- `nexusai.baoduong.dev` -> `IP_PUBLIC_EC2`

---

## 2. Cấu hình Kết nối PostgreSQL đã có sẵn

Vì ứng dụng chạy trong Docker container, việc kết nối tới PostgreSQL đã cài đặt ngoài Docker sẽ thông qua IP host ảo:

1. Trong file `docker-compose.yml`, dịch vụ backend đã được cấu hình `extra_hosts` kết nối tới `host.docker.internal`.
2. Trong file `.env` ở thư mục gốc của dự án, bạn sẽ khai báo `DATABASE_URL` trỏ tới host này:
   ```env
   DATABASE_URL="postgresql://db_user:db_password@host.docker.internal:5432/nexusai"
   ```
3. **Mở cấu hình PostgreSQL trên Host** để chấp nhận kết nối từ Docker container:
   - Mở file cấu hình Postgres `postgresql.conf`:
     ```bash
     sudo nano /etc/postgresql/16/main/postgresql.conf
     ```
     Sửa dòng `listen_addresses`:
     ```ini
     listen_addresses = '*'
     ```
   - Mở file phân quyền `pg_hba.conf`:
     ```bash
     sudo nano /etc/postgresql/16/main/pg_hba.conf
     ```
     Thêm dòng sau vào cuối file để cho phép subnet của Docker (thường là `172.17.0.0/16` hoặc `172.18.0.0/16`):
     ```text
     host    all             all             172.17.0.0/16           scram-sha-256
     host    all             all             172.18.0.0/16           scram-sha-256
     ```
   - Khởi động lại dịch vụ PostgreSQL trên host:
     ```bash
     sudo systemctl restart postgresql
     ```

---

## 3. Cấu hình Môi trường `.env` trên EC2

Truy cập thư mục dự án trên EC2:
```bash
cd /var/www/baoduong.dev/NexusAI
```

Tạo file `.env` tại thư mục gốc:
```bash
nano .env
```

Nội dung file `.env` mẫu dành cho production (sử dụng DB có sẵn):
```env
# Database Connection
DATABASE_URL="postgresql://postgres:your_password@host.docker.internal:5432/nexusai"

# JWT configuration
JWT_SECRET=your_super_secure_jwt_secret_key
JWT_EXPIRES_IN=7d

# AI Engine (Gemma hoặc OpenAI-compatible API)
AI_API_BASE=https://api.ai-box.vn/v1
AI_API_KEY=your_ai_api_key_here
AI_MODEL=deepseek-v4-flash[1m]

# AWS S3 Storage
S3_ACCESS_KEY_ID=your_aws_s3_access_key_id_here
S3_SECRET_ACCESS_KEY=your_aws_s3_secret_access_key_here
S3_REGION=ap-southeast-1
S3_BUCKET_NAME=your_s3_bucket_name_here
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
S3_PUBLIC_URL=https://your_s3_bucket_name_here.s3.ap-southeast-1.amazonaws.com

# URL Frontend & Backend
# QUAN TRỌNG: Thiết lập URL theo subdomain của bạn
FRONTEND_URL=https://nexusai.baoduong.dev
NEXT_PUBLIC_API_URL=https://nexusai.baoduong.dev/api
```

---

## 4. Khởi chạy Ứng dụng bằng Docker Compose

Bởi vì chúng ta dùng Nginx của Host, các container frontend và backend chỉ bind cổng nội bộ (`127.0.0.1:3000` và `127.0.0.1:4000`) để đảm bảo an toàn bảo mật, tránh bị truy cập trực tiếp từ Internet mà không đi qua Nginx.

### 4.1 Khởi chạy container
```bash
# Thực hiện build và chạy container ngầm
sudo docker-compose up -d --build
```

### 4.2 Seed dữ liệu mẫu (Chỉ chạy lần đầu tiên nếu DB trống)
```bash
sudo docker-compose exec backend npx prisma db seed
```

Kiểm tra xem các container đã hoạt động bình thường chưa:
```bash
sudo docker-compose ps
```

---

## 5. Cấu hình Nginx trên Host (EC2)

Bây giờ bạn cần cấu hình Nginx đang chạy trên máy chủ để nhận traffic từ cổng 80/443 của tên miền `nexusai.baoduong.dev` và chuyển tiếp vào các container Docker đang chạy nội bộ.

### 5.1 Tạo file cấu hình Nginx mới
Tạo một file cấu hình ảo cho subdomain:
```bash
sudo nano /etc/nginx/sites-available/nexusai
```

Thêm nội dung cấu hình proxy sau:
```nginx
server {
    listen 80;
    server_name nexusai.baoduong.dev;

    # Chuyển hướng HTTP sang HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nexusai.baoduong.dev;

    # Sử dụng chứng chỉ SSL Let's Encrypt sẵn có trên máy chủ
    # (Nếu chưa có, xem bước 5.3 bên dưới để sinh chứng chỉ trước)
    ssl_certificate /etc/letsencrypt/live/nexusai.baoduong.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexusai.baoduong.dev/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';

    # API Backend Proxy
    location /api {
        proxy_pass http://127.0.0.1:4000/api;
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

    # Frontend Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
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

### 5.2 Kích hoạt cấu hình Nginx
Tạo liên kết symlink để kích hoạt cấu hình và tải lại Nginx:
```bash
# Tạo link sang thư mục sites-enabled
sudo ln -s /etc/nginx/sites-available/nexusai /etc/nginx/sites-enabled/

# Kiểm tra cú pháp Nginx
sudo nginx -t

# Tải lại cấu hình Nginx
sudo systemctl reload nginx
```

### 5.3 Cấp chứng chỉ SSL trên Host bằng Certbot
Nếu bạn chưa có chứng chỉ SSL Let's Encrypt cho subdomain `nexusai.baoduong.dev`, hãy chạy lệnh sau trực tiếp trên máy chủ EC2 (sử dụng Certbot đã cài trên host):
```bash
sudo certbot --nginx -d nexusai.baoduong.dev
```
Lệnh này sẽ tự động sinh chứng chỉ và cập nhật trực tiếp đường dẫn file SSL vào file `/etc/nginx/sites-available/nexusai` cho bạn. Sau khi chạy xong, hãy chạy `sudo systemctl reload nginx` để áp dụng.

---

## 6. Xử lý sự cố thường gặp (Troubleshooting)

### 6.1 Lỗi kết nối PostgreSQL (Connection Refused)
- Kiểm tra xem PostgreSQL trên host có đang chạy và nghe đúng cổng 5432 không:
  ```bash
  sudo ss -tulpn | grep 5432
  ```
- Kiểm tra xem file cấu hình `/etc/postgresql/.../main/pg_hba.conf` đã cho phép dải IP Docker kết nối chưa.
- Kiểm tra logs của backend để xem lỗi cụ thể:
  ```bash
  sudo docker-compose logs -f backend
  ```
