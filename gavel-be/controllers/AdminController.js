const { Op } = require('sequelize');
const { User, sequelize } = require('../models');

const AdminController = {
    async listUsers(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const where = {};
            if (typeof req.query.q === 'string' && req.query.q.trim()) {
                const term = req.query.q.trim();
                where[Op.or] = [
                    { username: { [Op.like]: `%${term}%` } },
                    { email: { [Op.like]: `%${term}%` } }
                ];
            }

            const { rows, count } = await User.findAndCountAll({
                where,
                attributes: ['id', 'username', 'email', 'email_verified_at', 'avatar', 'role', 'is_active', 'createdAt'],
                order: [['createdAt', 'DESC']],
                limit,
                offset: (page - 1) * limit
            });
            return res.json({
                users: rows,
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            });
        } catch (err) {
            return next(err);
        }
    },

    async setUserStatus(req, res, next) {
        const targetId = Number(req.params.id);
        const { isActive } = req.body;
        if (!Number.isSafeInteger(targetId) || targetId <= 0 || typeof isActive !== 'boolean') {
            return res.status(400).json({ message: 'Mã tài khoản hoặc trạng thái không hợp lệ' });
        }
        if (targetId === Number(req.user.id) && !isActive) {
            return res.status(400).json({ message: 'Không thể tự khóa tài khoản quản trị của bạn' });
        }

        const transaction = await sequelize.transaction();
        try {
            const user = await User.findByPk(targetId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!user) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
            }

            if (user.role === 'admin' && !isActive) {
                const activeAdmins = await User.findAll({
                    where: { role: 'admin', is_active: true },
                    attributes: ['id'],
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });
                if (activeAdmins.length <= 1) {
                    await transaction.rollback();
                    return res.status(409).json({ message: 'Không thể khóa quản trị viên đang hoạt động cuối cùng' });
                }
            }

            if (user.is_active !== isActive) {
                await user.update({
                    is_active: isActive,
                    token_version: user.token_version + 1
                }, { transaction });
            }
            await transaction.commit();
            return res.json({
                message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    is_active: user.is_active
                }
            });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    }
};

module.exports = AdminController;
