const { sequelize, Bid, Auction, User } = require('../models');
const { getIO } = require('../services/io');
const { scheduleClose, enqueueOutbid } = require('../services/auctionScheduler');

const ANTI_SNIPING_MS = 2 * 60 * 1000;

const BidController = {
    async create(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const { auction_id, amount } = req.body;
            const user_id = req.user.id;

            // Khóa dòng (SELECT ... FOR UPDATE) để tránh race condition khi 2 người đặt giá cùng lúc
            const auction = await Auction.findByPk(auction_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!auction) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            const now = new Date();
            const status = now < new Date(auction.start_time) ? 'pending' : now > new Date(auction.end_time) ? 'ended' : 'active';

            if (status !== 'active') {
                await transaction.rollback();
                return res.status(400).json({ message: status === 'ended' ? 'Đấu giá đã kết thúc' : 'Đấu giá chưa bắt đầu' });
            }

            // Người bán không được tự đặt giá sản phẩm của mình
            if (Number(auction.seller_id) === Number(user_id)) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Bạn không thể đặt giá sản phẩm của chính mình' });
            }

            const minBid = Number(auction.current_price) + Number(auction.min_increment);

            if (Number(amount) < minBid) {
                await transaction.rollback();
                return res.status(400).json({ message: `Giá phải lớn hơn ${minBid.toLocaleString('vi-VN')}đ` });
            }

            const bid = await Bid.create({ auction_id, user_id, amount }, { transaction });

            const updateFields = { current_price: amount };

            // Anti-sniping: nếu còn < 2 phút thì cộng thêm 2 phút
            const remainingMs = new Date(auction.end_time).getTime() - now.getTime();
            let extendedEndTime = null;
            if (remainingMs > 0 && remainingMs < ANTI_SNIPING_MS) {
                extendedEndTime = new Date(auction.end_time.getTime() + ANTI_SNIPING_MS);
                updateFields.end_time = extendedEndTime;
            }

            await auction.update(updateFields, { transaction });
            await transaction.commit();

            const bidCount = await Bid.count({ where: { auction_id } });

            // Broadcast realtime cho tất cả client đang xem phiên này
            const io = getIO();
            io?.to(`auction_${auction_id}`).emit('bid:new', {
                auctionId: Number(auction_id),
                currentPrice: Number(amount),
                bidCount,
                endTime: extendedEndTime || auction.end_time,
                timeExtended: !!extendedEndTime,
                bidder: { id: Number(user_id), username: req.user.username || 'N/A' },
                createdAt: bid.created_at
            });

            // Lên lịch đóng phiên với end_time mới (nếu bị kéo dài)
            scheduleClose(auction_id, extendedEndTime || auction.end_time);

            // Thông báo cho những người bị vượt giá (qua message queue)
            enqueueOutbid(auction_id, Number(user_id), Number(amount));

            return res.status(201).json({
                message: 'Đặt giá thành công',
                bidCount,
                currentPrice: Number(amount),
                endTime: extendedEndTime || auction.end_time
            });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            next(err);
        }
    },

    async findByAuction(req, res, next) {
        try {
            const auctionId = req.params.auctionId;
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
            const offset = (page - 1) * limit;

            const { rows, count } = await Bid.findAndCountAll({
                where: { auction_id: auctionId },
                include: [{ model: User, as: 'bidder', attributes: ['id', 'username'] }],
                order: [['amount', 'DESC']],
                limit,
                offset
            });

            res.json({
                bids: rows.map(b => ({
                    id: b.id,
                    bidderName: b.bidder?.username,
                    amount: Number(b.amount),
                    time: b.created_at
                })),
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = BidController;
