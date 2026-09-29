# GAVEL Frontend — Nền tảng đấu giá trực tuyến

Frontend cho dự án GAVEL (đấu giá trực tuyến): Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Socket.io-client.

## Tính năng

- **Đấu giá realtime**: trang chi tiết phiên join room `auction_<id>` qua WebSocket, cập nhật giá hiện tại, số lượt đặt giá, thời gian (kể cả khi bị kéo dài do anti-sniping) và trạng thái kết thúc **ngay lập tức** — không cần refresh. **Khách chưa đăng nhập cũng xem được giá realtime**, không chỉ người đã đăng nhập.
- Trang chủ: banner, thống kê, tìm kiếm, lọc theo danh mục và sắp xếp.
- Đặt giá (kiểm tra giá tối thiểu, bước giá, +5 bước).
- Theo dõi (watchlist), hồ sơ người dùng, đánh giá có hình ảnh/video.
- Chat realtime giữa người mua và người bán (báo rõ lỗi khi hết rate limit hoặc chưa đăng nhập).
- Đăng bán / chỉnh sửa / xóa sản phẩm (upload nhiều ảnh/video).
- Dark mode, responsive.

## Phiên đăng nhập

Token **không** lưu trong `localStorage`. Backend set cookie `httpOnly` và mọi request đi kèm `credentials: 'include'`, nên XSS không đọc được token.

- Access token sống 15 phút, refresh token 30 ngày (cookie ghim vào path `/api/auth`).
- Khi gặp 401, `lib/api.ts` tự gọi `/auth/refresh` rồi thử lại request (nhiều request cùng lúc chỉ refresh một lần).
- `GET /auth/me` là nguồn sự thật về việc đang đăng nhập. `localStorage.user` chỉ là cache để hiển thị, không dùng để xác thực.
- `notifySessionChanged()` trong `lib/socket.ts` báo cho socket biết phiên đổi để tạo lại kết nối với danh tính mới (socket lấy danh tính từ cookie qua `withCredentials`).

## Cài đặt & chạy

### Yêu cầu
- Node.js ≥ 20
- Backend GAVEL đang chạy ở `http://localhost:3001` (xem `gavel-be/README.md`)

### Bước cài đặt

```bash
cd gavel-fe
npm install
cp .env.example .env.local   # (nếu có) hoặc tạo .env.local:
```

File `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Chạy:

```bash
npm run dev      # http://localhost:3000
# hoặc build production:
npm run build && npm start
```

## Cấu trúc

```
gavel-fe/
├── app/
│   ├── page.tsx              # Trang chủ
│   ├── auction/[id]/page.tsx # Chi tiết phiên + đấu giá realtime
│   ├── auth/signin|signup    # Đăng nhập / đăng ký
│   ├── chat/                 # Danh sách hội thoại + phòng chat
│   ├── sell/                 # Đăng bán / sửa sản phẩm
│   ├── user/[id]/page.tsx    # Hồ sơ người dùng + đánh giá
│   └── watchlist/            # Danh sách theo dõi
├── components/               # Header, Footer, AuctionCard/Grid, ChatSidebar...
├── lib/
│   ├── api.ts                # Client gọi REST API
│   ├── socket.ts             # Socket.io client + helper realtime đấu giá
│   └── favorites.ts          # Watchlist (localStorage)
└── types/                    # TypeScript types (Auction, Chat, Review...)
```

### Realtime đấu giá trên trang chi tiết

- `joinAuctionRoom(id)` — gửi `auction:join` để vào room `auction_<id>`.
- `onBidNew(cb)` — lắng nghe `bid:new`: cập nhật `currentPrice`, `bidCount`, `endTime`, chèn bid mới lên đầu lịch sử, nhắc "đã cộng thêm 2 phút" khi bị kéo dài.
- `onAuctionEnded(cb)` — lắng nghe `auction:ended`: chuyển phiên sang `ended`, hiển thị người thắng.

> Socket không yêu cầu đăng nhập: khách xem vẫn nhận `bid:new` / `auction:ended`. Riêng các event chat cần đăng nhập, nếu không server trả lỗi qua `ack`.

## API client

`lib/api.ts` gói gọn các lời gọi REST. Danh sách phiên hỗ trợ phân trang:

```ts
api.getAuctions({ page: 1, limit: 20, status: "active", q: "iphone", sort: "ending_soon" })
// -> { items, total, page, limit, totalPages }
```

## Lint & TypeScript

```bash
npm run lint
npx tsc --noEmit
```
