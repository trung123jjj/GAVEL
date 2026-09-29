const { Auction, Category, User, Bid, Review, Notification, Order } = require('../models');

const UserController = {
    async updateAvatar(req, res, next) {
        try {
            const userId = Number(req.user.id);
            const { avatar } = req.body;

            if (!avatar) {
                return res.status(400).json({ message: 'Vui lòng cung cấp ảnh đại diện' });
            }

            const [affected] = await User.update(
                { avatar },
                { where: { id: userId } }
            );
            if (affected === 0) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }
            res.json({ message: 'Cập nhật ảnh đại diện thành công', avatar });
        } catch (err) {
            next(err);
        }
    },

    async getProfile(req, res, next) {
        try {
            const user = await User.findByPk(req.params.id, {
                attributes: ['id', 'username', 'avatar', 'role', 'createdAt']
            });

            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }

            const auctions = await Auction.findAll({
                where: { seller_id: user.id },
                include: [
                    { model: Category, as: 'categories', attributes: ['id', 'name'], through: { attributes: [] } },
                    { model: Bid, as: 'bids', attributes: ['id'] }
                ],
                order: [['created_at', 'DESC']]
            });

            const reviews = await Review.findAll({
                where: { user_id: user.id },
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

            const avgRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

            const result = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                role: user.role,
                joinedAt: user.createdAt,
                auctionCount: auctions.length,
                auctions: auctions.map(a => {
                    const now = new Date();
                    const status = now < new Date(a.start_time) ? 'pending' : now > new Date(a.end_time) ? 'ended' : 'active';
                    return {
                        id: a.id,
                        title: a.title,
                        description: a.description,
                        image: a.image,
                        images: a.images || [],
                        startingPrice: Number(a.starting_price),
                        currentPrice: Number(a.current_price),
                        minIncrement: Number(a.min_increment),
                        bidCount: a.bids?.length || 0,
                        sellerId: user.id,
                        seller: user.username,
                        sellerAvatar: user.avatar,
                        startTime: a.start_time,
                        endTime: a.end_time,
                        status,
                        categories: a.categories?.map(c => c.name) || []
                    };
                }),
                reviews: reviews.map(r => ({
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
                })),
                averageRating: Math.round(avgRating * 10) / 10
            };

            res.json(result);
        } catch (err) {
            next(err);
        }
    },

    async getNotifications(req, res, next) {
        try {
            const userId = Number(req.user.id);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

            const notifications = await Notification.findAll({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                limit
            });
            const unreadCount = await Notification.count({ where: { user_id: userId, read: false } });

            res.json({
                notifications: notifications.map(n => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    auctionId: n.auction_id,
                    read: n.read,
                    createdAt: n.created_at
                })),
                unreadCount
            });
        } catch (err) {
            next(err);
        }
    },

    async markNotificationsRead(req, res, next) {
        try {
            const userId = Number(req.user.id);
            await Notification.update({ read: true }, { where: { user_id: userId, read: false } });
            res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = UserController;
