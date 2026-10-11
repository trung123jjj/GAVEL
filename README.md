# GAVEL

GAVEL là nền tảng đấu giá trực tuyến, gồm frontend Next.js và backend Express. Người dùng có thể đăng sản phẩm, tham gia đấu giá realtime, trao đổi với người mua/người bán và theo dõi giao dịch sau khi phiên kết thúc.

> GAVEL hiện không xử lý hoặc xác minh thanh toán. Người mua và người bán tự thống nhất thanh toán bên ngoài hệ thống; trang Giao dịch hỗ trợ cập nhật các bước thanh toán, gửi hàng và nhận hàng.

## Tính năng chính

- Danh sách, tìm kiếm, lọc và xem chi tiết các phiên đấu giá.
- Đấu giá realtime qua Socket.io; kiểm tra giá trong transaction với row lock để tránh cập nhật chồng khi có nhiều lượt đặt giá đồng thời.
- Tự động kết thúc phiên và tạo giao dịch cho người thắng; đặt giá trong hai phút cuối có thể kéo dài phiên thêm hai phút.
- Đăng bán, chỉnh sửa sản phẩm, tải nhiều ảnh và video.
- Tài khoản, cookie đăng nhập httpOnly, xác minh email và khôi phục mật khẩu.
- Danh sách theo dõi, chat realtime, đánh giá sau giao dịch và thông báo.
- Trang quản trị để quản lý tài khoản, gỡ sản phẩm và xem xét báo cáo.
- Nếu Redis không khả dụng, scheduler chuyển sang chế độ in-process để ứng dụng tiếp tục chạy.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, Sequelize 6 |
| Database | MySQL 8 |
| Realtime | Socket.io |
| Background jobs | BullMQ và Redis (Redis tùy chọn; có fallback in-process) |
| Kiểm thử backend | Jest, Supertest |

## Yêu cầu

- Node.js 20 trở lên (khuyến nghị Node.js 22).
- npm.
- MySQL 8 đang chạy.
- Redis 6 trở lên là tùy chọn cho BullMQ. Không có Redis thì scheduler dùng in-process; chế độ này không thay thế Redis bền vững khi chạy nhiều backend instance.

## Chạy local bằng PowerShell

### 1. Cài dependency

```powershell
cd C:\GAVEL\gavel-be
npm ci

cd C:\GAVEL\gavel-fe
npm ci
```

### 2. Cấu hình backend

Tạo database MySQL, sau đó tạo file cấu hình backend:

```powershell
Copy-Item C:\GAVEL\gavel-be\.env.example C:\GAVEL\gavel-be\.env
```

Mở `gavel-be\.env` và cập nhật các giá trị phù hợp:

| Biến | Mục đích |
| --- | --- |
| `DB_HOST`, `DB_PORT` | Host và port từ dịch vụ MySQL/TiDB; local thường là `localhost`, `3306` |
| `DB_NAME` | Tên database ứng dụng |
| `DB_USER`, `DB_PASSWORD` | Tài khoản MySQL |
| `DB_SSL` | Đặt `true` để bật TLS cho database khác; TiDB Cloud Public Endpoint tự bật TLS theo `DB_HOST` |
| `DB_SSL_CA` | Tùy chọn: toàn bộ nội dung CA PEM nếu Node.js không xác minh được chứng chỉ server bằng CA hệ thống |
| `JWT_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự; không dùng giá trị mẫu |
| `CLIENT_URL` | Origin frontend, local thường là `http://localhost:3000` |
| `PUBLIC_API_URL` | Origin backend nhìn từ trình duyệt, local thường là `http://localhost:3001` |
| `REDIS_URL` | URL Redis; nếu Redis không chạy, backend dùng in-process scheduler |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP cho xác minh email và khôi phục mật khẩu |

Tạo secret ngẫu nhiên cho JWT bằng PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

SMTP cần thông tin từ nhà cung cấp email. Port 587 thường dùng `SMTP_SECURE=false`; port 465 thường dùng `SMTP_SECURE=true`. Nếu chưa cấu hình SMTP, các thao tác gửi email sẽ không hoạt động, nhưng server vẫn có thể khởi động.

Với TiDB Cloud Public Endpoint, dùng `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` do TiDB cấp và tạo database riêng (ví dụ `gavel_db`) thay vì dùng database hệ thống `sys`. Backend tự bật TLS tối thiểu 1.2 và xác minh chứng chỉ dựa trên hostname TiDB. Nếu Node.js báo lỗi xác minh chứng chỉ, tải CA root được TiDB hướng dẫn và dán toàn bộ nội dung PEM vào `DB_SSL_CA`.

### 3. Cấu hình frontend

Tạo file `.env.local`:

```powershell
Copy-Item C:\GAVEL\gavel-fe\.env.example C:\GAVEL\gavel-fe\.env.local
```

Giá trị local mặc định:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Khởi động backend và frontend

Mở hai cửa sổ PowerShell riêng.

**Cửa sổ 1 — backend** (migration sẽ tự chạy khi khởi động):

```powershell
cd C:\GAVEL\gavel-be
npm run dev
```

**Cửa sổ 2 — frontend**:

```powershell
cd C:\GAVEL\gavel-fe
npm run dev
```

Mở frontend tại `http://localhost:3000`. Backend API mặc định ở `http://localhost:3001/api`; kiểm tra backend tại `http://localhost:3001/health`.

## Migration, kiểm thử và lint

Chạy các lệnh backend trong `gavel-be`:

```powershell
npm run migrate
npm run migrate:status
npm test
```

Chạy các lệnh frontend trong `gavel-fe`:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Backend tests sử dụng database riêng tên `gavel_db_test` và tạo/xóa schema kiểm thử. Không cấu hình `DB_NAME` của test trỏ vào database chứa dữ liệu thật.

Kiểm tra SMTP đã cấu hình (không gửi email):

```powershell
cd C:\GAVEL\gavel-be
npm run smtp:verify
```

## Tài khoản quản trị

Đăng ký tài khoản bình thường, sau đó người có quyền truy cập database có thể cấp role admin:

```sql
UPDATE users SET role = 'admin' WHERE username = 'ten_dang_nhap';
```

Không có API công khai để tự nâng quyền. Chỉ cấp role admin cho tài khoản đáng tin cậy.

## API và realtime

Backend có API cho xác thực, sản phẩm, đặt giá, upload, thông báo, watchlist, chat, giao dịch, đánh giá và quản trị. Các endpoint quản trị nằm dưới `/api/admin` và yêu cầu tài khoản admin. Báo cáo sản phẩm yêu cầu đăng nhập; mỗi người dùng chỉ gửi một báo cáo cho một sản phẩm.

Socket.io phát các sự kiện realtime như `bid:new`, `auction:ended` và sự kiện chat. Khách chưa đăng nhập có thể theo dõi cập nhật đấu giá công khai; chat yêu cầu xác thực. Chi tiết API và socket events nằm trong [tài liệu backend](gavel-be/README.md).

Thông tin sử dụng frontend, phiên đăng nhập và luồng realtime nằm trong [tài liệu frontend](gavel-fe/README.md).

## Docker Compose

Repository có `docker-compose.yml`, hiện được cấu hình chủ yếu cho local development. Backend container cần file `gavel-be/.env`. Compose đọc `DB_NAME` và `DB_PASSWORD` từ file `.env` ở thư mục gốc để cấu hình MySQL; file `.env.example` ở gốc chỉ chứa biến frontend, không phải cấu hình database.

Trước khi chạy Compose, hãy tạo `gavel-be/.env` từ `gavel-be/.env.example`, đồng thời tạo file `.env` ở gốc chứa `DB_NAME` và `DB_PASSWORD`. Đặt cùng database name/password trong hai nơi cấu hình. Compose hiện có giá trị mặc định `root` cho mật khẩu MySQL; chỉ dùng cho môi trường local dùng một mình, tuyệt đối không dùng mặc định này cho môi trường chia sẻ hoặc production.

Lưu ý: `NEXT_PUBLIC_API_URL` được Next.js nhúng vào frontend khi build. Trong Compose hiện tại, biến này chỉ được đặt lúc chạy container chứ chưa được truyền vào bước build; vì vậy cấu hình Compose hiện tại dùng URL local mặc định `http://localhost:3001/api`, không phải cấu hình production cho domain khác. Muốn triển khai bằng Compose trên domain thật, cần truyền `NEXT_PUBLIC_API_URL` vào bước build của frontend trước khi build image và cấu hình CORS/cookie backend theo domain đó.

Sau khi cấu hình local:

```powershell
cd C:\GAVEL
docker compose up --build
```

Trong production, không giữ URL `localhost`: trình duyệt của người dùng phải truy cập được API URL đã được nhúng khi build frontend, đồng thời backend cần cho phép đúng origin frontend.

Nếu frontend Vercel dùng domain mặc định `vercel.app` và backend dùng `onrender.com`, hãy cấu hình Vercel để proxy API cùng origin, tránh cookie đăng nhập cross-site:

```dotenv
NEXT_PUBLIC_API_URL=/api
BACKEND_ORIGIN=https://<ten-backend>.onrender.com
```

`BACKEND_ORIGIN` là biến build/runtime phía server của Next.js; không thêm tiền tố `NEXT_PUBLIC_`. Các rewrite trong `next.config.ts` chuyển `/api`, `/uploads` và `/socket.io` sang backend Render. Trên Render, đặt `CLIENT_URL` là origin Vercel chính xác (không dấu `/` cuối).

## Chuẩn bị production

- Dùng HTTPS để cookie phiên được bảo vệ; cấu hình đúng `CLIENT_URL`, `PUBLIC_API_URL` và `NEXT_PUBLIC_API_URL`.
- Lưu JWT secret, mật khẩu database và SMTP credentials bằng secret manager của nền tảng deploy. Không commit `.env`.
- Dùng SMTP đã xác minh domain/sender; chạy `npm run smtp:verify` và thử xác minh email/khôi phục mật khẩu trên staging. Email gửi lỗi hiện trả lỗi cho thao tác đó; ứng dụng chưa có hàng đợi tự gửi bù.
- Cấu hình uptime monitor gọi `GET /health`. Endpoint trả 200 nếu database sẵn sàng, 503 nếu database không truy cập được; trường scheduler cho biết đang chạy BullMQ hay in-process.
- Thu thập stdout/stderr và đặt cảnh báo cho HTTP 5xx, lỗi khởi động, SMTP outage và Redis fallback. Không log credentials hoặc nội dung email.
- Sao lưu database MySQL định kỳ, mã hóa và lưu ngoài máy chủ ứng dụng; sao lưu thư mục `gavel-be/uploads` nếu ảnh vẫn được lưu trên filesystem. Kiểm thử khôi phục vào database riêng.
- In-process scheduler phù hợp fallback trên một tiến trình; đánh giá Redis dùng chung, lưu trữ upload bền vững và xử lý nhiều instance trước khi scale ngang.

## Cấu trúc repository

```text
GAVEL/
├── gavel-be/       # Express API, Sequelize models/migrations, Socket.io, tests
├── gavel-fe/       # Next.js frontend
├── docker-compose.yml
└── README.md       # Hướng dẫn tổng quan dự án
```
