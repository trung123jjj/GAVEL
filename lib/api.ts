const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const BACKEND_URL = API_URL.replace(/\/api\/?$/, '');

export type AuthUser = {
  id: number;
  username: string;
  avatar: string | null;
  role?: string;
};

// Phiên đăng nhập nằm trong cookie httpOnly do backend quản lý — không có token
// nào được lưu trong localStorage, nên XSS không lấy được token.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // Nhiều request cùng hết hạn sẽ chỉ gọi refresh một lần.
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // Cho phép thử lại ở lần 401 sau nếu lần này thất bại.
        setTimeout(() => { refreshInFlight = null; }, 0);
      });
  }
  return refreshInFlight;
}

async function request(path: string, options: RequestInit = {}, isRetry = false) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  // Access token ngắn hạn có thể hết hạn giữa chừng — thử làm mới rồi gọi lại.
  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, options, true);
  }

  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
}

export const API_BASE = BACKEND_URL;

export const api = {
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  register: (data: { username: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  // Nguồn sự thật về việc đang đăng nhập hay không, thay cho việc đọc localStorage.
  me: () => request('/auth/me'),

  getAuctions: (params?: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    return request(`/auctions${qs ? `?${qs}` : ""}`);
  },

  getAuction: (id: string) => request(`/auctions/${id}`),

  createAuction: (data: Record<string, unknown>) =>
    request('/auctions', { method: 'POST', body: JSON.stringify(data) }),

  updateAuction: (id: string, data: Record<string, unknown>) =>
    request(`/auctions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteAuction: (id: string) =>
    request(`/auctions/${id}`, { method: 'DELETE' }),

  placeBid: (auction_id: string, amount: number) =>
    request('/bids', { method: 'POST', body: JSON.stringify({ auction_id, amount }) }),

  getCategories: () => request('/categories'),

  getUserProfile: (id: string) => request(`/users/${id}?t=${Date.now()}`),

  updateAvatar: (avatar: string) =>
    request('/users/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) }),

  getNotifications: () => request('/users/notifications'),

  markNotificationsRead: () =>
    request('/users/notifications/read', { method: 'POST' }),

  getReviews: (userId: string) => request(`/reviews/user/${userId}`),

  createReview: (userId: string, data: { rating: number; comment: string; media: { type: string; url: string }[] }) =>
    request(`/reviews/user/${userId}`, { method: 'POST', body: JSON.stringify(data) }),

  getConversations: () => request('/chat/conversations'),

  getConversation: (userId: string) => request(`/chat/conversation/${userId}`),

  sendMessage: (conversation_id: string, content: string) =>
    request('/chat/messages', { method: 'POST', body: JSON.stringify({ conversation_id, content }) }),

  upload: async (files: File[]) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));

    // Không tự đặt Content-Type: trình duyệt phải tự gắn boundary.
    // Trước đây dựng URL bằng `API_URL.replace('/api','')` rồi nối lại '/api',
    // dễ vỡ nếu domain có chứa chuỗi "api".
    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: fd
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Upload failed');
    return data.urls as string[];
  }
};
