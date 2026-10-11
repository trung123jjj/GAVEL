const jwt = require('jsonwebtoken');
const { JWT_SECRET, NODE_ENV } = require('../config/env');

// Access token sống ngắn (15 phút) nên khi bị đánh cắp cũng hại hạn ngắn.
// Refresh token sống lâu hơn nhưng chỉ nằm trong cookie httpOnly, và bị ghim
// vào path /api/auth để không bị gửi kèm mọi request.
const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

const ACCESS_COOKIE = 'gavel_at';
const REFRESH_COOKIE = 'gavel_rt';

const baseCookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production'
};

function signAccessToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, typ: 'access', tv: user.token_version || 0 },
        JWT_SECRET,
        { expiresIn: ACCESS_TTL }
    );
}

function signRefreshToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, typ: 'refresh', tv: user.token_version || 0 },
        JWT_SECRET,
        { expiresIn: REFRESH_TTL }
    );
}

function verifyToken(token, expectedType) {
    const payload = jwt.verify(token, JWT_SECRET);
    // Chặn dùng nhầm refresh token ở chỗ cần access token và ngược lại.
    if (payload.typ !== expectedType) {
        throw new Error('Wrong token type');
    }
    return payload;
}

function setAuthCookies(res, user) {
    res.cookie(ACCESS_COOKIE, signAccessToken(user), { ...baseCookie, path: '/', maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, signRefreshToken(user), {
        ...baseCookie,
        path: '/api/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
}

function clearAuthCookies(res) {
    res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
}

// Chấp nhận cả cookie lẫn header Bearer.
// Header được giữ lại cho client không dùng cookie (mobile, test, tích hợp ngoài).
function extractToken(req, type) {
    const cookieName = type === 'refresh' ? REFRESH_COOKIE : ACCESS_COOKIE;
    const fromCookie = req.cookies && req.cookies[cookieName];
    if (fromCookie) return fromCookie;

    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    return null;
}

function readAccessToken(req) {
    const token = extractToken(req, 'access');
    if (!token) return null;
    try {
        return verifyToken(token, 'access');
    } catch {
        return null;
    }
}

function readRefreshToken(req) {
    const token = extractToken(req, 'refresh');
    if (!token) return null;
    try {
        return verifyToken(token, 'refresh');
    } catch {
        return null;
    }
}

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    ACCESS_TTL,
    REFRESH_TTL,
    signAccessToken,
    signRefreshToken,
    verifyToken,
    setAuthCookies,
    clearAuthCookies,
    readAccessToken,
    readRefreshToken
};
