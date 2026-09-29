const { readAccessToken } = require('../services/tokenService');

module.exports = function auth(req, res, next) {
    const payload = readAccessToken(req);

    if (!payload) {
        return res.status(401).json({ message: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
    }

    req.user = payload;
    return next();
};
