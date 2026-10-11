const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, AccountToken, sequelize } = require('../models');
const { CLIENT_URL } = require('../config/env');
const { sendMail } = require('../services/emailService');
const { setAuthCookies, clearAuthCookies, readRefreshToken } = require('../services/tokenService');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_VERIFICATION = 'email_verification';
const PASSWORD_RESET = 'password_reset';

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueAccountToken(user, purpose, email = null) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (purpose === PASSWORD_RESET ? PASSWORD_RESET_TTL_MS : TOKEN_TTL_MS));
    await AccountToken.upsert({
        user_id: user.id,
        purpose,
        email,
        token_hash: hashToken(token),
        expires_at: expiresAt
    });
    return token;
}

async function sendAccountLink(user, token, purpose, email) {
    const isReset = purpose === PASSWORD_RESET;
    const path = isReset ? '/auth/reset-password' : '/auth/verify-email';
    const url = `${CLIENT_URL}${path}?token=${encodeURIComponent(token)}`;
    await sendMail({
        to: email,
        subject: isReset ? 'Đặt lại mật khẩu GAVEL' : 'Xác minh email GAVEL',
        text: `${isReset ? 'Đặt lại mật khẩu' : 'Xác minh email'} cho tài khoản ${user.username}: ${url}\nLiên kết hết hạn sau ${isReset ? 30 : 60} phút.`,
        html: `<p>Xin chào,</p><p><a href="${url}">${isReset ? 'Đặt lại mật khẩu' : 'Xác minh email'}</a></p><p>Liên kết hết hạn sau ${isReset ? 30 : 60} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
    });
}

function publicUser(user) {
    return { id: user.id, username: user.username, avatar: user.avatar || null, role: user.role };
}

const AuthController = {
    async register(req, res, next) {
        try {
            const { username, password } = req.body;
            const email = req.body.email.trim().toLowerCase();

            const existing = await User.findByUsername(username);
            if (existing.length > 0) {
                return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
            }
            if (await User.findOne({ where: { email } })) {
                return res.status(400).json({ message: 'Email đã được sử dụng' });
            }

            const hashed = await bcrypt.hash(password, 10);
            const user = await User.create({ username, password: hashed, email });
            const token = await issueAccountToken(user, EMAIL_VERIFICATION);
            await sendAccountLink(user, token, EMAIL_VERIFICATION, email);

            setAuthCookies(res, user);

            return res.status(201).json({
                message: 'Đăng ký thành công. Vui lòng xác minh email để sử dụng khôi phục mật khẩu.',
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
            if (!valid || !user.is_active) {
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
            if (!user || !user.is_active) {
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa' });
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

    async requestPasswordReset(req, res, next) {
        try {
            const email = req.body.email.trim().toLowerCase();
            const user = await User.findOne({
                where: { email, email_verified_at: { [Op.ne]: null } }
            });
            if (user) {
                const token = await issueAccountToken(user, PASSWORD_RESET);
                await sendAccountLink(user, token, PASSWORD_RESET, email);
            }
            return res.json({
                message: 'Nếu email thuộc tài khoản đã xác minh, liên kết đặt lại mật khẩu sẽ được gửi.'
            });
        } catch (err) {
            return next(err);
        }
    },

    async resetPassword(req, res, next) {
        const { token, password } = req.body;
        const passwordHash = hashToken(token);
        const transaction = await sequelize.transaction();
        try {
            const accountToken = await AccountToken.findOne({
                where: { purpose: PASSWORD_RESET, token_hash: passwordHash },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!accountToken || new Date(accountToken.expires_at).getTime() <= Date.now()) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
            }

            const user = await User.findByPk(accountToken.user_id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!user || !user.email_verified_at) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
            }

            await user.update({
                password: await bcrypt.hash(password, 10),
                token_version: user.token_version + 1
            }, { transaction });
            await AccountToken.destroy({ where: { user_id: user.id }, transaction });
            await transaction.commit();
            clearAuthCookies(res);
            return res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    },

    async verifyRecoveryEmail(req, res, next) {
        const tokenHash = hashToken(req.body.token);
        const transaction = await sequelize.transaction();
        try {
            const accountToken = await AccountToken.findOne({
                where: { purpose: EMAIL_VERIFICATION, token_hash: tokenHash },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!accountToken || new Date(accountToken.expires_at).getTime() <= Date.now()) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Liên kết xác minh email không hợp lệ hoặc đã hết hạn' });
            }

            const user = await User.findByPk(accountToken.user_id, { transaction, lock: transaction.LOCK.UPDATE });
            const email = accountToken.email || user?.email;
            if (!user || !email) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Liên kết xác minh email không hợp lệ hoặc đã hết hạn' });
            }

            const emailInUse = await User.findOne({
                where: { email, id: { [Op.ne]: user.id } },
                transaction
            });
            if (emailInUse) {
                await transaction.rollback();
                return res.status(409).json({ message: 'Email đã được sử dụng bởi tài khoản khác' });
            }

            await user.update({ email, email_verified_at: new Date() }, { transaction });
            await AccountToken.destroy({
                where: { user_id: user.id, purpose: EMAIL_VERIFICATION },
                transaction
            });
            await transaction.commit();
            return res.json({ message: 'Email đã được xác minh' });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    },

    async resendEmailVerification(req, res, next) {
        try {
            const email = req.body.email.trim().toLowerCase();
            const user = await User.findOne({ where: { email, email_verified_at: null } });
            if (user) {
                const token = await issueAccountToken(user, EMAIL_VERIFICATION);
                await sendAccountLink(user, token, EMAIL_VERIFICATION, email);
            }
            return res.json({ message: 'Nếu email cần xác minh thuộc tài khoản, hướng dẫn xác minh sẽ được gửi.' });
        } catch (err) {
            return next(err);
        }
    },

    async requestRecoveryEmail(req, res, next) {
        try {
            const email = req.body.email.trim().toLowerCase();
            const user = await User.findByPk(req.user.id);
            if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
            if (!(await bcrypt.compare(req.body.password, user.password))) {
                return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
            }
            const emailInUse = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } });
            if (emailInUse) return res.status(409).json({ message: 'Email đã được sử dụng bởi tài khoản khác' });

            const token = await issueAccountToken(user, EMAIL_VERIFICATION, email);
            await sendAccountLink(user, token, EMAIL_VERIFICATION, email);
            return res.json({ message: 'Đã gửi liên kết xác minh đến email mới' });
        } catch (err) {
            return next(err);
        }
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
