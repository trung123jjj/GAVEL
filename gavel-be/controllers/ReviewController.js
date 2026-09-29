const { Review, User, Order, Auction } = require('../models');

const ReviewController = {
    async getByUser(req, res, next) {
        try {
            const reviews = await Review.findAll({
                where: { user_id: req.params.userId },
                include: [
                    { model: User, as: 'buyer', attributes: ['id', 'username', 'avatar'] },
                    {
                        model: Order,
                        as: 'order',
                        include: [{ model: Auction, as: 'auction', attributes: ['id', 'title'] }]
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            const result = reviews.map(r => ({
                id: r.id,
                buyerId: r.buyer_id,
                buyerName: r.buyer?.username || '',
                buyerAvatar: r.buyer?.avatar || null,
                auctionId: r.order?.auction?.id || null,
                auctionTitle: r.order?.auction?.title || '',
                rating: r.rating,
                comment: r.comment,
                media: r.media || [],
                createdAt: r.created_at
            }));

            res.json(result);
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const { rating, comment, media } = req.body;
            const buyer_id = req.user.id;
            const seller_id = Number(req.params.userId);

            if (Number(buyer_id) === seller_id) {
                return res.status(400).json({ message: 'Bạn không thể tự đánh giá chính mình' });
            }

            // Chỉ cho phép đánh giá khi có một giao dịch thực sự:
            // người đánh giá là người thắng phiên (buyer), người được đánh giá là người bán.
            const order = await Order.findOne({
                where: { seller_id, buyer_id },
                include: [{ model: Auction, as: 'auction', attributes: ['id', 'title'] }],
                order: [['created_at', 'DESC']]
            });

            if (!order) {
                return res.status(403).json({
                    message: 'Bạn chỉ có thể đánh giá người này sau khi hoàn tất một giao dịch đấu giá với họ'
                });
            }

            // Mỗi giao dịch chỉ được đánh giá 1 lần
            const existing = await Review.findOne({ where: { order_id: order.id } });
            if (existing) {
                return res.status(400).json({ message: 'Bạn đã đánh giá giao dịch này rồi' });
            }

            const review = await Review.create({
                user_id: seller_id,
                buyer_id,
                order_id: order.id,
                rating,
                comment: comment || '',
                media: media || []
            });

            res.status(201).json({
                message: 'Đánh giá thành công',
                id: review.id,
                auctionId: order.auction?.id || null,
                auctionTitle: order.auction?.title || ''
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = ReviewController;
