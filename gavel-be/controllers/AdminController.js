const { Op, literal } = require('sequelize');
const { User, Auction, Bid, Category, Order, Notification, sequelize } = require('../models');

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
    },
    async listAuctions(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const where = {};
            if (typeof req.query.q === 'string' && req.query.q.trim()) {
                const term = req.query.q.trim();
                where[Op.or] = [
                    { title: { [Op.like]: `%${term}%` } },
                    { description: { [Op.like]: `%${term}%` } }
                ];
            }
            if (req.query.status === 'removed') {
                where.removed_at = { [Op.ne]: null };
            } else if (req.query.status !== 'all') {
                where.removed_at = null;
                const now = new Date();
                if (req.query.status === 'active') {
                    where.start_time = { [Op.lte]: now };
                    where.end_time = { [Op.gt]: now };
                } else if (req.query.status === 'pending') {
                    where.start_time = { [Op.gt]: now };
                } else if (req.query.status === 'ended') {
                    where.end_time = { [Op.lte]: now };
                } else if (req.query.status !== undefined && req.query.status !== 'all') {
                    return res.status(400).json({ message: 'Bộ lọc trạng thái không hợp lệ' });
                }
            }

            const { rows, count } = await Auction.findAndCountAll({
                where,
                attributes: {
                    include: [[
                        literal('(SELECT COUNT(*) FROM bids WHERE bids.auction_id = `Auction`.`id`)'),
                        'bidCount'
                    ]]
                },
                include: [
                    { model: User, as: 'seller', attributes: ['id', 'username'] },
                    { model: Category, as: 'categories', attributes: ['id', 'name'], through: { attributes: [] } },
                    { model: Order, as: 'order', attributes: ['id', 'status'], required: false }
                ],
                order: [['createdAt', 'DESC'], ['id', 'DESC']],
                limit,
                offset: (page - 1) * limit,
                distinct: true
            });
            const now = new Date();
            return res.json({
                auctions: rows.map((auction) => ({
                    id: auction.id,
                    title: auction.title,
                    description: auction.description,
                    image: auction.image,
                    currentPrice: Number(auction.current_price),
                    startTime: auction.start_time,
                    endTime: auction.end_time,
                    status: auction.removed_at
                        ? 'removed'
                        : now < new Date(auction.start_time)
                            ? 'pending'
                            : now >= new Date(auction.end_time)
                                ? 'ended'
                                : 'active',
                    bidCount: Number(auction.get('bidCount')) || 0,
                    seller: auction.seller ? { id: auction.seller.id, username: auction.seller.username } : null,
                    categories: auction.categories.map((category) => category.name),
                    removedAt: auction.removed_at,
                    removalReason: auction.removal_reason,
                    orderStatus: auction.order?.status || null
                })),
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            });
        } catch (err) {
            return next(err);
        }
    },

    async removeAuction(req, res, next) {
        const auctionId = Number(req.params.id);
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (!Number.isSafeInteger(auctionId) || auctionId <= 0 || !reason || reason.length > 1000) {
            return res.status(400).json({ message: 'Mã sản phẩm hoặc lý do gỡ không hợp lệ' });
        }

        const transaction = await sequelize.transaction();
        try {
            const auction = await Auction.findByPk(auctionId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!auction || auction.removed_at) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm chưa bị gỡ' });
            }

            const bidUsers = await Bid.findAll({
                where: { auction_id: auctionId },
                attributes: ['user_id'],
                group: ['user_id'],
                raw: true,
                transaction
            });
            const order = await Order.findOne({
                where: { auction_id: auctionId },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            const cancelledOrder = order && !['completed', 'cancelled'].includes(order.status);
            if (cancelledOrder) {
                await order.update({ status: 'cancelled' }, { transaction });
            }

            await auction.update({
                status: 'ended',
                removed_at: new Date(),
                removed_by: Number(req.user.id),
                removal_reason: reason
            }, { transaction });

            const recipientIds = new Set([
                Number(auction.seller_id),
                ...bidUsers.map((bid) => Number(bid.user_id))
            ]);
            if (cancelledOrder) recipientIds.add(Number(order.buyer_id));

            await Notification.bulkCreate([...recipientIds].map((userId) => ({
                user_id: userId,
                type: 'system',
                title: 'Phiên đấu giá đã bị quản trị viên gỡ',
                message: `Phiên "${auction.title}" đã được gỡ khỏi danh sách công khai. Lý do: ${reason}${cancelledOrder ? ' Đơn hàng chưa hoàn tất đã được hủy.' : ''}`,
                auction_id: auctionId
            })), { transaction });

            await transaction.commit();
            return res.json({
                message: 'Đã gỡ sản phẩm khỏi danh sách công khai; lịch sử đấu giá được giữ lại',
                auctionId,
                orderStatus: order ? (cancelledOrder ? 'cancelled' : order.status) : null
            });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    }
};

module.exports = AdminController;
