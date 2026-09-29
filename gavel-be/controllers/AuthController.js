const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { setAuthCookies, clearAuthCookies, readRefreshToken } = require('../services/tokenService');

function publicUser(user) {
    return { id: user.id, username: user.username, avatar: user.avatar || null, role: user.role };
}

const AuthController = {
    async register(req, res, next) {
        try {
            const { username, password } = req.body;

            const existing = await User.findByUsername(username);
            if (existing.length > 0) {
                return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
            }

            const hashed = await bcrypt.hash(password, 10);
            const user = await User.create({ username, password: hashed });

            setAuthCookies(res, user);

            return res.status(201).json({
                message: 'Đăng ký thành công',
                user: publicUser(user)
            });
        } catch (err) {
            return next(err);
        }
    },

    async login(req, res, next) {
        try {
            const { username, password } = req.body;

            const users = await User.findByUsername(username);
            if (users.length === 0) {
                return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
            }

            const user = users[0];
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
            }

            setAuthCookies(res, user);

            return res.json({
                message: 'Đăng nhập thành công',
                user: publicUser(user)
            });
        } catch (err) {
            return next(err);
        }
    },

    // Đổi access token mới từ refresh token. Đây là chỗ duy nhất cần đọc DB để
    // đối chiếu token_version — nhờ vậy mỗi request thường không phải query DB.
    async refresh(req, res, next) {
        try {
            const payload = readRefreshToken(req);
            if (!payload) {
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
            }

            const user = await User.findByPk(payload.id);
            if (!user) {
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Tài khoản không tồn tại' });
            }

            // Đã logout-everywhere / đổi mật khẩu => mọi refresh token cũ mất hiệu lực.
            if ((payload.tv || 0) !== (user.token_version || 0)) {
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Phiên đăng nhập đã bị vô hiệu hoá' });
            }

            setAuthCookies(res, user);
            return res.json({ user: publicUser(user) });
        } catch (err) {
            return next(err);
        }
    },

    async logout(req, res) {
        clearAuthCookies(res);
        return res.json({ message: 'Đã đăng xuất' });
    },

    // Frontend dùng endpoint này để biết mình đang đăng nhập hay không
    // (thay cho việc đọc token trong localStorage).
    async me(req, res, next) {
        try {
            const user = await User.findByPk(req.user.id);
            if (!user) {
                return res.status(401).json({ message: 'Tài khoản không tồn tại' });
            }
            return res.json({ user: publicUser(user) });
        } catch (err) {
            return next(err);
        }
    }
};

module.exports = AuthController;
