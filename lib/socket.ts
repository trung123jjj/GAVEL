import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let connecting = false;

// Sự kiện nội bộ: bắn khi phiên đăng nhập đổi (login/logout) để socket cũ bị
// bỏ và tạo lại — vì danh tính giờ nằm trong cookie chứ không nằm trong token
// mà ta có thể so sánh.
const SESSION_CHANGED = "gavel:session-changed";

export function notifySessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  if (socket && !socket.connected && !connecting) {
    // Socket đã bị server đóng — socket.io tự reconnect, không cần tạo mới.
    socket.connect();
    return socket;
  }

  if (socket) return socket;

  const BACKEND =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:3001";

  connecting = true;
  socket = io(BACKEND, {
    // Không gửi token: danh tính đến từ cookie httpOnly (withCredentials).
    // Khách chưa đăng nhập vẫn kết nối được để theo dõi giá realtime.
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => { connecting = false; });
  socket.on("disconnect", () => { connecting = false; });

  socket.on(SESSION_CHANGED, () => {
    disconnectSocket();
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connecting = false;
}

export function isAuthenticatedSocket(): boolean {
  return Boolean(socket?.connected && socket.id);
}

// --- Realtime auction (đấu giá trực tiếp) ---
export function joinAuctionRoom(auctionId: string | number) {
  getSocket()?.emit("auction:join", String(auctionId));
}

export function leaveAuctionRoom(auctionId: string | number) {
  getSocket()?.emit("auction:leave", String(auctionId));
}

export type BidNewPayload = {
  auctionId: number;
  currentPrice: number;
  bidCount: number;
  endTime: string;
  timeExtended: boolean;
  bidder: { id: number; username: string };
  createdAt: string;
};

export type AuctionEndedPayload = {
  auctionId: number;
  endTime: string;
  winner: { id: number; username: string } | null;
  finalPrice: number;
};

export function onBidNew(cb: (payload: BidNewPayload) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("bid:new", cb);
  return () => s.off("bid:new", cb);
}

export function onAuctionEnded(cb: (payload: AuctionEndedPayload) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on("auction:ended", cb);
  return () => s.off("auction:ended", cb);
}
