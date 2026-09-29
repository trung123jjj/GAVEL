const { CLIENT_URL, PUBLIC_API_URL, NODE_ENV } = require('./env');

const isDev = NODE_ENV !== 'production';

function originOf(url, fallback) {
    try {
        return new URL(url || fallback).origin;
    } catch {
        return fallback;
    }
}

const apiOrigin = originOf(PUBLIC_API_URL, 'http://localhost:3001');
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const clientOrigin = originOf(CLIENT_URL, 'http://localhost:3000');

/**
 * Tách riêng khỏi app.js để policy dễ đọc và dễ test.
 *
 * Lưu ý: 'unsafe-inline' cho script là điểm yếu còn lại của chính sách này —
 * Next.js inject thẻ <script> nội tuyến. Muốn siết chặt hơn thì phải chuyển
 * frontend sang CSP nonce (middleware của Next) thay vì tắt CSP như trước đây.
 */
function contentSecurityPolicy() {
    return {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', apiOrigin],
            mediaSrc: ["'self'", 'blob:', apiOrigin],
            fontSrc: ["'self'", 'data:'],
            // Phải mở ra API + WebSocket, nếu không realtime sẽ không kết nối được.
            connectSrc: ["'self'", apiOrigin, wsOrigin],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            // Chỉ bật khi chạy thật qua HTTPS; ở localhost http sẽ hỏng.
            upgradeInsecureRequests: isDev ? null : []
        }
    };
}

function helmetOptions() {
    return {
        contentSecurityPolicy: contentSecurityPolicy(),
        // Ảnh/video upload được phục vụ từ origin của backend cho frontend ở
        // origin khác, nên phải cho phép cross-origin thay vì tắt hẳn.
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    };
}

module.exports = { helmetOptions, contentSecurityPolicy, apiOrigin, clientOrigin, wsOrigin };
