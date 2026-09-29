# GAVEL Backend — Nền tảng đấu giá trực tuyến

Backend cho dự án GAVEL (đấu giá trực tuyến): Express 5 + Sequelize 6 + Socket.io 4 + BullMQ 6 (Redis).

## Tính năng nổi bật

- **Đấu giá realtime qua WebSocket (Socket.io)**: client join room `auction_<id>`, nhận sự kiện `bid:new` và `auction:ended` ngay khi có người đặt giá — **không cần đăng nhập** (khách chỉ cần xem giá).
- **Chống race condition khi đặt giá**: toàn bộ luồng *đọc → kiểm tra → ghi* nằm trong một Sequelize transaction với **row lock (`SELECT ... FOR UPDATE`)** trên bản ghi auction.
- **Message queue (BullMQ + Redis)**: job tự động **đóng phiên đấu giá đúng `end_time`**, tạo đơn hàng (order), gửi thông báo cho người thắng và người bị vượt giá. Nếu không có Redis, hệ thống tự chuyển sang bộ lập lịch in-process (không crash).
- **Chống sniping**: đặt giá trong 2 phút cuối tự cộng thêm 2 phút.
- **Đơn hàng / người thắng cuộc**: bảng `orders` ghi nhận người thắng, giá chốt, trạng thái thanh toán/giao hàng.
- **Đánh giá theo giao dịch thật**: chỉ người thắng phiên mới đánh giá được người bán, mỗi giao dịch một đánh giá.
- **Xác thực bằng cookie httpOnly**: access token 15 phút + refresh token 30 ngày, không lưu token trong `localStorage` nên XSS không lấy được phiên. Có cơ chế thu hồi phiên qua `users.token_version`.
- **Phân quyền phòng chat**: mỗi người chỉ vào được phòng `conv_<id>` mình là thành viên.
- **Chống lạm dụng socket**: rate limit riêng cho gửi tin nhắn, đọc tin nhắn và join phòng đấu giá.
- **Upload có bảo mật**: yêu cầu xác thực + kiểm tra **magic bytes** thật của file.
- **Rate limiting** cho login/register, refresh và đặt giá.
- **Quản lý schema bằng migration** thay vì `sequelize.sync({ alter: true })`.
- **Phân trang + lọc/sắp xếp** cho danh sách phiên đấu giá.
- **Kiểm thử tự động** (Jest + Supertest) chạy trên DB test riêng (`gavel_db_test`).

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 22, Express 5 |
| ORM | Sequelize 6 + MySQL (mysql2) |
| Realtime | Socket.io 4 |
| Message queue | BullMQ 6 + ioredis (Redis) — có fallback in-process |
| Xác thực | JWT (jsonwebtoken) trong cookie httpOnly + bcryptjs |
| Validation | express-validator |
| Upload | multer + kiểm tra magic bytes |
| Rate limit | express-rate-limit (HTTP) + limiter in-process (socket) |
| Bảo mật | helmet (CSP bật), cors cấu hình nguồn cụ thể |
| Schema | Migration tự viết (`migrations/`), theo dõi bằng `SequelizeMeta` |
| Test | Jest + Supertest + socket.io-client |

## Cài đặt & chạy

### Yêu cầu
- Node.js ≥ 20
- MySQL ≥ 8 (đang chạy)
- (Tùy chọn) Redis ≥ 6 — nếu không có, app vẫn chạy bằng bộ lập lịch in-process

### Bước cài đặt

```bash
cd gavel-be
npm install
cp .env.example .env   # rồi điền DB_PASSWORD, JWT_SECRET (chuỗi dài ngẫu nhiên)
npm run migrate        # tạo/cập nhật schema
npm start              # hoặc: node app.js (tự chạy migration luôn)
```

Server mặc định chạy ở `http://localhost:3001`.

> Nếu thiếu biến môi trường bắt buộc hoặc `JWT_SECRET` còn là giá trị dễ đoán (ngắn hơn 32 ký tự, hoặc khớp mẫu `gavel_secret_key*` / `*change_me*` / `secret*`), server **từ chối khởi động** (fail-fast).

Sinh `JWT_SECRET` an toàn:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Migration

Schema do migration quản lý, **không** dùng `sequelize.sync({ alter: true })` (dễ mất dữ liệu khi chạy lại trên production).

```bash
npm run migrate          # áp dụng migration còn thiếu
npm run migrate:status   # xem trạng thái từng migration
```

Migration nằm trong `migrations/`, tên file `<timestamp>-<slug>.js`, mỗi cái chạy trong transaction riêng và được ghi vào bảng `SequelizeMeta`.

### Chạy test

```bash
npm test
```

Test dùng DB riêng `gavel_db_test` (tự tạo, tự xóa sau khi chạy) — **không đụng vào DB thật**.

## Kiến trúc

```
gavel-be/
├── app.js                    # Khởi động Express, route, socket, migration, scheduler
├── migrate.js                # CLI: npm run migrate / migrate:status
├── socket.js                 # Socket.io: chat + auction room + xác thực (ẩn danh cho phép)
├── config/
│   ├── env.js                # Validate biến môi trường (fail-fast)
│   ├── sequelize.js          # Kết nối Sequelize (log SQL chỉ ở dev)
│   ├── security.js           # Chính sách helmet + CSP
│   └── ...
├── migrations/               # Migration schema (runner.js + <timestamp>-<slug>.js)
├── models/                   # Sequelize models + associations (index.js)
│   ├── User, Auction, Bid, Category, AuctionCategory
│   ├── Review, Order, Notification
│   └── Conversation, Message
├── controllers/              # Xử lý logic nghiệp vụ
├── routes/                   # Định nghĩa endpoint + validation + rate limit
├── middleware/               # auth (JWT), errorHandler, validate, rateLimit, cors
├── services/
│   ├── auctionScheduler.js   # BullMQ queue/worker + fallback in-process
│   ├── tokenService.js       # Access/refresh token + cookie httpOnly
│   ├── socketRateLimit.js    # Rate limit theo socket cho từng event
│   └── io.js                 # Singleton io để controller broadcast
├── utils/fileMagic.js        # Kiểm tra magic bytes của file
└── tests/                    # Jest + Supertest (auth, auction, review, socket, scheduler)
```

### Luồng đấu giá realtime

1. Frontend mở trang chi tiết → `socket.emit('auction:join', auctionId)` → join room `auction_<id>`.
2. Người dùng đặt giá qua `POST /api/bids`.
3. `BidController.create`:
   - Mở transaction, **khóa dòng auction** (`lock: t.LOCK.UPDATE`).
   - Kiểm tra phiên đang `active`, người đặt không phải người bán, giá ≥ giá hiện tại + bước giá.
   - Tạo bid, cập nhật `current_price`, áp dụng anti-sniping (nếu còn < 2 phút → cộng 2 phút) — **tất cả trong cùng transaction**.
   - Commit → `io.to('auction_<id>').emit('bid:new', { currentPrice, bidCount, endTime, bidder, ... })`.
   - Đẩy job `close-auction` (delay = thời gian còn lại) và job `notify-outbid`.
4. Khi hết giờ, worker đóng phiên (`status = 'ended'`), tạo `Order` cho người thắng, gửi thông báo, emit `auction:ended`.

### Bảo mật đã triển khai

- JWT_SECRET bắt buộc, không có secret mặc định dễ đoán; không log secret ra console.
- **Token nằm trong cookie httpOnly** (`gavel_at` 15 phút, `gavel_rt` 30 ngày ghim vào path `/api/auth`) — không có token nào trong `localStorage`, nên XSS không đánh cắp được phiên.
- Header `Authorization: Bearer` vẫn được chấp nhận cho client không dùng cookie (mobile, test, tích hợp ngoài).
- Thu hồi phiên: tăng `users.token_version` làm mọi refresh token cũ mất hiệu lực (đọc DB ở `/auth/refresh` nên request thường không phải query DB).
- Cookie dùng `SameSite=Lax` + CORS giới hạn đúng `CLIENT_URL`; chạy production cần HTTPS (cookie tự bật `Secure`).
- Password hash bằng bcrypt (cost 10).
- Upload yêu cầu đăng nhập + xác thuyết nội dung file bằng magic bytes.
- Rate limit chống brute-force / spam bid / spam tin nhắn qua socket.
- Người bán không đặt giá sản phẩm của mình.
- **Phòng chat được kiểm tra thành viên**: socket chỉ join được `conv_<id>` mình là thành viên; event chat từ chối socket ẩn danh.
- Phiên có lượt đặt giá không cho sửa giá/thời gian và không cho xóa.
- `.gitignore` loại bỏ `.env`, `node_modules`, `uploads/`.

### Về Content Security Policy

`config/security.js` bật CSP của helmet cho các response từ backend (mở `img-src`/`media-src`/`connect-src` cho origin API + WebSocket, chặn `object-src`, `frame-ancestors`).

Lưu ý thẳng thắn: backend không phục vụ HTML, nên CSP ở đây chủ yếu là lớp phòng thủ thứ cấp. **Chính sách CSP có tác dụng thật phải đặt ở frontend** (Next.js) qua middleware sinh nonce — mới bảo vệ được các trang HTML. Việc này chưa làm.

Ngoài ra `script-src` vẫn cần `'unsafe-inline'` vì Next.js inject script nội tuyến; muốn siết hơn thì phải chuyển frontend sang nonce.

## API chính

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Đăng ký (set cookie phiên) | — |
| POST | `/api/auth/login` | Đăng nhập (set cookie phiên) | — |
| POST | `/api/auth/refresh` | Làm mới access token từ refresh cookie | — |
| POST | `/api/auth/logout` | Xoá cookie phiên | — |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại | ✅ |
| GET | `/api/auctions?page&limit&q&category&status&sort` | Danh sách phiên (phân trang, lọc, sắp xếp) | — |
| GET | `/api/auctions/:id` | Chi tiết phiên + lịch sử đặt giá | — |
| POST | `/api/auctions` | Tạo phiên | ✅ |
| PUT | `/api/auctions/:id` | Sửa phiên (khóa giá/thời gian khi có bid) | ✅ |
| DELETE | `/api/auctions/:id` | Xóa phiên (chặn khi có bid) | ✅ |
| POST | `/api/bids` | Đặt giá (transaction + row lock) | ✅ |
| GET | `/api/bids/auction/:auctionId?page&limit` | Lịch sử đặt giá (phân trang) | — |
| POST | `/api/upload` | Upload ảnh/video (magic bytes check) | ✅ |
| GET | `/api/users/:id` | Hồ sơ người dùng | — |
| GET | `/api/users/notifications` | Danh sách thông báo | ✅ |
| POST | `/api/users/notifications/read` | Đánh dấu đã đọc | ✅ |
| GET | `/api/reviews/user/:userId` | Danh sách đánh giá | — |
| POST | `/api/reviews/user/:userId` | Đánh giá (chỉ khi có giao dịch hoàn tất) | ✅ |
| GET | `/api/chat/conversations` | Danh sách hội thoại | ✅ |
| GET | `/api/chat/conversation/:userId?limit` | Hội thoại + tin nhắn (phân trang) | ✅ |
| POST | `/api/chat/messages` | Gửi tin nhắn | ✅ |

### Socket events

Client gửi: `auction:join`, `auction:leave`, `conversation:join`, `conversation:leave`, `message:send`, `message:read`

Kết nối **không bắt buộc đăng nhập**: khách chưa đăng nhập vẫn theo dõi được `bid:new` / `auction:ended` (dữ liệu công khai của phiên). Các event chat sẽ trả `{ ok: false, error }` nếu socket không có danh tính.

Server gửi:
- `bid:new` → `{ auctionId, currentPrice, bidCount, endTime, timeExtended, bidder, createdAt }`
- `auction:ended` → `{ auctionId, endTime, winner, finalPrice }`
- `message:new`, `message:read`, `conversation:update`

Giới hạn tần suất socket (trong bộ nhớ, theo tiến trình):

| Event | Cho phép |
|---|---|
| `message:send` | 20 / 10 giây |
| `conversation:join`, `message:read` | 60 / phút |
| `auction:join` | 60 / phút |

## ERD tóm tắt

```
users 1───* auctions(seller)      auctions 1───* bids(bidder)
users 1───* bids(user_id)         users 1───* reviews(user_id / buyer_id)
auctions *───* categories (qua auction_categories)
auctions 1───1 orders              orders 1───1 reviews
users 1───* notifications
users *───* conversations (qua user1_id, user2_id)
conversations 1───* messages
```
## Lưu ý khi dùng message queue

- Với Redis: app tự dùng **BullMQ** (`auction-jobs` queue). Xem log khởi động để xác nhận `Redis connected`.
- Không có Redis: log cảnh báo và chuyển sang **in-process scheduler** — mọi tính năng vẫn hoạt động, chỉ khác là job không bền với restart (phiên quá hạn sẽ được xử lý lại khi server khởi động).
