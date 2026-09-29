const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút.' }
});

const bidLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Bạn đang đặt giá quá nhanh. Vui lòng chậm lại.' }
});

// Access token sống 15 phút nên người dùng đang hoạt động sẽ gọi /auth/refresh
// khoảng 4 lần/giờ (~60 lần/15 phút). Phải tách khỏi authLimiter (max 20)
// nếu không sẽ tự đá người dùng ra khỏi hệ thống.
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu làm mới phiên. Vui lòng thử lại sau.' }
});

module.exports = { authLimiter, bidLimiter, refreshLimiter };
