const { Op } = require('sequelize');
const { sequelize, Order, Auction, User, Notification } = require('../models');

const statusMessages = {
    paid: {
        title: 'Người mua đã xác nhận thanh toán',
        message: 'Người mua cho biết đã thanh toán bên ngoài GAVEL. Vui lòng xác nhận và tiến hành giao hàng.'
    },
    shipped: {
        title: 'Đơn hàng đã được gửi',
        message: 'Người bán đã cập nhật đơn hàng là đã gửi. Vui lòng theo dõi và xác nhận khi nhận được hàng.'
    },
    completed: {
        title: 'Giao dịch đã hoàn tất',
        message: 'Người mua đã xác nhận nhận hàng. Giao dịch đấu giá đã hoàn tất.'
    }
};

function serializeOrder(order, userId) {
    const isBuyer = Number(order.buyer_id) === userId;
    const other = isBuyer ? order.seller : order.buyer;
    const nextStatus = order.status === 'pending' && isBuyer
        ? 'paid'
        : order.status === 'paid' && !isBuyer
            ? 'shipped'
            : order.status === 'shipped' && isBuyer
                ? 'completed'
                : null;

    return {
        id: order.id,
        status: order.status,
        amount: Number(order.amount),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        role: isBuyer ? 'buyer' : 'seller',
        nextStatus,
        otherUser: other ? { id: other.id, username: other.username, avatar: other.avatar || null } : null,
        auction: order.auction ? {
            id: order.auction.id,
            title: order.auction.title,
            image: order.auction.image || null
        } : null
    };
}

const OrderController = {
    async list(req, res, next) {
        try {
            const userId = Number(req.user.id);
            const orders = await Order.findAll({
                where: { [Op.or]: [{ buyer_id: userId }, { seller_id: userId }] },
                include: [
                    { model: Auction, as: 'auction', attributes: ['id', 'title', 'image'] },
                    { model: User, as: 'seller', attributes: ['id', 'username', 'avatar'] },
                    { model: User, as: 'buyer', attributes: ['id', 'username', 'avatar'] }
                ],
                order: [['createdAt', 'DESC']]
            });
            res.json(orders.map((order) => serializeOrder(order, userId)));
        } catch (err) {
            next(err);
        }
    },

    async updateStatus(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const userId = Number(req.user.id);
            const order = await Order.findByPk(req.params.id, {
                include: [
                    { model: Auction, as: 'auction', attributes: ['id', 'title', 'image'] },
                    { model: User, as: 'seller', attributes: ['id', 'username', 'avatar'] },
                    { model: User, as: 'buyer', attributes: ['id', 'username', 'avatar'] }
                ],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!order) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
            }

            const isBuyer = Number(order.buyer_id) === userId;
            const isSeller = Number(order.seller_id) === userId;
            if (!isBuyer && !isSeller) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Bạn không có quyền cập nhật giao dịch này' });
            }

            const allowed = (order.status === 'pending' && isBuyer && req.body.status === 'paid')
                || (order.status === 'paid' && isSeller && req.body.status === 'shipped')
                || (order.status === 'shipped' && isBuyer && req.body.status === 'completed');
            if (!allowed) {
                await transaction.rollback();
                return res.status(409).json({ message: 'Trạng thái giao dịch không hợp lệ hoặc bạn không thể thực hiện bước này' });
            }

            await order.update({ status: req.body.status }, { transaction });
            const recipientId = isBuyer ? Number(order.seller_id) : Number(order.buyer_id);
            const notice = statusMessages[req.body.status];
            await Notification.create({
                user_id: recipientId,
                type: 'system',
                title: notice.title,
                message: `${notice.message} Sản phẩm: "${order.auction?.title || 'Phiên đấu giá'}".`,
                auction_id: order.auction_id
            }, { transaction });

            await transaction.commit();
            return res.json(serializeOrder(order, userId));
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    }
};

module.exports = OrderController;
