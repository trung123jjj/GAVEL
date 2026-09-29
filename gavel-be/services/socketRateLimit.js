/**
 * Rate limit theo "fixed window" cho socket event, key theo (socketId, event).
 * Chạy trong bộ nhớ từng tiến trình — đủ dùng khi chạy một instance backend;
 * nếu scale ngang nhiều instance thì cần chuyển sang Redis.
 */
function createSocketLimiter({ windowMs, max, name }) {
    const hits = new Map();

    function sweep() {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }

    // Dọn rác định kỳ. unref() để không giữ process sống.
    const timer = setInterval(sweep, windowMs);
    if (typeof timer.unref === 'function') timer.unref();

    /**
     * @returns {boolean} true nếu được phép, false nếu đã vượt giới hạn.
     */
    function allow(key, now = Date.now()) {
        const existing = hits.get(key);
        if (!existing || existing.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }
        existing.count += 1;
        return existing.count <= max;
    }

    function retryAfterMs(key, now = Date.now()) {
        const entry = hits.get(key);
        if (!entry) return 0;
        return Math.max(0, entry.resetAt - now);
    }

    function reset() {
        hits.clear();
    }

    function dispose() {
        clearInterval(timer);
        hits.clear();
    }

    return { allow, retryAfterMs, reset, dispose, name, max, windowMs };
}

// Chat: tránh spam tin nhắn (20 tin / 10 giây).
const messageLimiter = createSocketLimiter({
    name: 'message:send',
    windowMs: 10 * 1000,
    max: 20
});

// Đọc tin nhắn / join phòng hội thoại: 60 lần / phút.
const conversationLimiter = createSocketLimiter({
    name: 'conversation',
    windowMs: 60 * 1000,
    max: 60
});

// Theo dõi phiên đấu giá: 60 lần / phút, đủ cho việc lưới trang bình thường
// nhưng chặn việc spam hàng loạt phòng.
const auctionRoomLimiter = createSocketLimiter({
    name: 'auction:join',
    windowMs: 60 * 1000,
    max: 60
});

module.exports = {
    createSocketLimiter,
    messageLimiter,
    conversationLimiter,
    auctionRoomLimiter
};
