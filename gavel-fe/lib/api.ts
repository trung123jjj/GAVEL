const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const BACKEND_URL = API_URL.replace(/\/api\/?$/, '');

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const LOGIN_REQUIRED_EVENT = 'gavel:login-required';
let loginRequiredPending = false;

function requiresLogin(path: string, method = 'GET') {
  const normalizedMethod = method.toUpperCase();
  if (path === '/auth/recovery-email') return true;
  if (path === '/bids' || path === '/upload' || path.startsWith('/chat/')) return true;
  if (/^\/users\/(avatar|notifications|watchlist)(\/|$)/.test(path)) return true;
  if (/^\/reviews\/user\/[^/]+$/.test(path)) return normalizedMethod === 'POST';
  if (path === '/auctions') return normalizedMethod === 'POST';
  if (/^\/auctions\/[^/]+$/.test(path)) return ['PUT', 'DELETE'].includes(normalizedMethod);
  return false;
}

function notifyLoginRequired() {
  if (typeof window !== 'undefined') {
    loginRequiredPending = true;
    window.dispatchEvent(new CustomEvent(LOGIN_REQUIRED_EVENT));
  }
}

export function consumeLoginRequiredPrompt() {
  const pending = loginRequiredPending;
  loginRequiredPending = false;
  return pending;
}

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
  const needsLogin = requiresLogin(path, options.method);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  // Access token ngắn hạn có thể hết hạn giữa chừng — thử làm mới rồi gọi lại.
  if (res.status === 401 && !isRetry && needsLogin) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, options, true);
  }
  if (res.status === 401 && needsLogin) {
    notifyLoginRequired();
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
    throw new ApiError(data?.message || 'Request failed', res.status);
  }

  return data;
}

export const API_BASE = BACKEND_URL;

export const api = {
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  register: (data: { username: string; password: string; email: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  requestPasswordReset: (email: string) =>
    request('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request('/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),

  verifyEmail: (token: string) =>
    request('/auth/email/verify', { method: 'POST', body: JSON.stringify({ token }) }),

  resendEmailVerification: (email: string) =>
    request('/auth/email/verification/resend', { method: 'POST', body: JSON.stringify({ email }) }),

  requestRecoveryEmail: (email: string, password: string) =>
    request('/auth/recovery-email', { method: 'POST', body: JSON.stringify({ email, password }) }),

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

  getWatchlist: () =>
    request('/users/watchlist') as Promise<{ auctionIds: number[] }>,

  syncWatchlist: (auctionIds: string[]) =>
    request('/users/watchlist/sync', { method: 'POST', body: JSON.stringify({ auctionIds }) }) as Promise<{ auctionIds: number[] }>,

  addWatchlistItem: (auctionId: string) =>
    request(`/users/watchlist/${encodeURIComponent(auctionId)}`, { method: 'POST' }),

  removeWatchlistItem: (auctionId: string) =>
    request(`/users/watchlist/${encodeURIComponent(auctionId)}`, { method: 'DELETE' }),

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

    const data = await request('/upload', { method: 'POST', body: fd });
    return data.urls as string[];
  }
};
