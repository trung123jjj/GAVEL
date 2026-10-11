const { readAccessToken } = require('../services/tokenService');
const { User } = require('../models');

module.exports = async function auth(req, res, next) {
    const payload = readAccessToken(req);

    if (!payload) {
        return res.status(401).json({ message: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
    }

    try {
        const user = await User.findByPk(payload.id, {
            attributes: ['id', 'username', 'role', 'is_active', 'token_version']
        });
        if (!user) {
            return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
        }
        if (!user.is_active) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
        }
        if ((payload.tv || 0) !== (user.token_version || 0)) {
            return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
        }

        req.user = { ...payload, username: user.username, role: user.role };
        return next();
    } catch (err) {
        return next(err);
    }
};
