const { Auction, Category, User, Bid, AuctionCategory, sequelize } = require('../models');
const { Op } = require('sequelize');
const { scheduleStart, scheduleClose } = require('../services/auctionScheduler');

function computeStatus(a, now = new Date()) {
    return now < new Date(a.start_time) ? 'pending' : now > new Date(a.end_time) ? 'ended' : 'active';
}

function mapAuction(a, now = new Date()) {
    const status = computeStatus(a, now);
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
        sellerId: a.seller?.id,
        seller: a.seller?.username,
        sellerAvatar: a.seller?.avatar || null,
        startTime: a.start_time,
        endTime: a.end_time,
        status,
        categories: a.categories?.map(c => c.name) || []
    };
}

const AuctionController = {
    async findAll(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const offset = (page - 1) * limit;

            const where = {};
            if (req.query.q) {
                where[Op.or] = [
                    { title: { [Op.like]: `%${req.query.q}%` } },
                    { description: { [Op.like]: `%${req.query.q}%` } }
                ];
            }

            const now = new Date();
            if (req.query.status === 'active') where[Op.and] = [{ start_time: { [Op.lte]: now } }, { end_time: { [Op.gt]: now } }];
            if (req.query.status === 'pending') where.start_time = { [Op.gt]: now };
            if (req.query.status === 'ended') where.end_time = { [Op.lt]: now };

            const sortMap = {
                newest: [['created_at', 'DESC']],
                highest_price: [['current_price', 'DESC']],
                lowest_price: [['current_price', 'ASC']],
                ending_soon: [['end_time', 'ASC']]
            };
            const order = sortMap[req.query.sort] || sortMap.ending_soon;

            const include = [
                { model: User, as: 'seller', attributes: ['id', 'username', 'avatar'] },
                { model: Bid, as: 'bids', attributes: ['id'] }
            ];

            const categoryInclude = {
                model: Category,
                as: 'categories',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            };
            if (req.query.category && req.query.category !== 'Tất cả') {
                categoryInclude.where = { name: req.query.category };
            }
            include.push(categoryInclude);

            const { rows, count } = await Auction.findAndCountAll({
                where,
                include,
                order,
                limit,
                offset,
                distinct: true
            });

            const items = rows.map(a => mapAuction(a, now));

            res.json({
                items,
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            });
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            const auction = await Auction.findByPk(req.params.id, {
                include: [
                    { model: User, as: 'seller', attributes: ['id', 'username', 'avatar'] },
                    { model: Category, as: 'categories', attributes: ['id', 'name'], through: { attributes: [] } },
                    {
                        model: Bid,
                        as: 'bids',
                        include: [{ model: User, as: 'bidder', attributes: ['id', 'username'] }],
                        order: [['amount', 'DESC']]
                    }
                ]
            });

            if (!auction) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            const now = new Date();
            const status = computeStatus(auction, now);
            const result = {
                id: auction.id,
                title: auction.title,
                description: auction.description,
                image: auction.image,
                images: auction.images || [],
                startingPrice: Number(auction.starting_price),
                currentPrice: Number(auction.current_price),
                minIncrement: Number(auction.min_increment),
                bidCount: auction.bids?.length || 0,
                sellerId: auction.seller?.id,
                seller: auction.seller?.username,
                sellerAvatar: auction.seller?.avatar || null,
                startTime: auction.start_time,
                endTime: auction.end_time,
                status,
                categories: auction.categories?.map(c => c.name) || [],
                bids: (auction.bids || []).map(b => ({
                    id: b.id,
                    bidderName: b.bidder?.username,
                    amount: Number(b.amount),
                    time: b.created_at
                }))
            };

            res.json(result);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const auction = await Auction.findByPk(req.params.id);
            if (!auction) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            if (Number(auction.seller_id) !== req.user.id) {
                return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa sản phẩm này' });
            }

            const { title, description, image, images, starting_price, min_increment, start_time, end_time, category_ids, custom_categories } = req.body;

            // Nếu đã có lượt đặt giá: khóa các trường ảnh hưởng giá/thời gian
            const bidCount = await Bid.count({ where: { auction_id: auction.id } });
            if (bidCount > 0) {
                const lockedProvided = [starting_price, min_increment, start_time, end_time].some(v => v !== undefined && v !== null && v !== '');
                if (lockedProvided) {
                    return res.status(400).json({
                        message: 'Không thể thay đổi giá hoặc thời gian đấu giá khi đã có lượt đặt giá'
                    });
                }
            }

            if (end_time && start_time && new Date(end_time) <= new Date(start_time)) {
                return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
            }

            const newStart = start_time ? new Date(start_time) : auction.start_time;
            const newEnd = end_time ? new Date(end_time) : auction.end_time;
            const newStatus = computeStatus({ start_time: newStart, end_time: newEnd });

            const updatedImages = images && images.length > 0 ? images : (image ? [image] : null);
            const finalImages = updatedImages || auction.images || [];
            const finalImage = updatedImages ? updatedImages[0] : (image || auction.image);

            await auction.update({
                title: title || auction.title,
                description: description || auction.description,
                image: finalImage,
                images: finalImages,
                starting_price: starting_price || auction.starting_price,
                min_increment: min_increment || auction.min_increment,
                start_time: newStart,
                end_time: newEnd,
                status: newStatus
            });

            if (category_ids || custom_categories) {
                await AuctionCategory.destroy({ where: { auction_id: auction.id } });

                const allCategoryIds = [...(category_ids || [])];
                if (custom_categories && custom_categories.length > 0) {
                    for (const name of custom_categories) {
                        let cat = await Category.findOne({ where: { name } });
                        if (!cat) cat = await Category.create({ name });
                        allCategoryIds.push(cat.id);
                    }
                }
                for (const catId of allCategoryIds) {
                    await AuctionCategory.create({ auction_id: auction.id, category_id: catId });
                }
            }

            // Nếu thời gian bị thay đổi khi chưa có bid, lên lịch lại job đóng/mở phiên
            if (bidCount === 0 && (start_time || end_time)) {
                scheduleStart(auction.id, newStart);
                scheduleClose(auction.id, newEnd);
            }

            res.json({ message: 'Cập nhật thành công' });
        } catch (err) { next(err); }
    },

    async delete(req, res, next) {
        try {
            const auction = await Auction.findByPk(req.params.id);
            if (!auction) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            if (Number(auction.seller_id) !== req.user.id) {
                return res.status(403).json({ message: 'Bạn không có quyền xóa sản phẩm này' });
            }

            // Không cho xóa phiên đã có lượt đặt giá — bảo vệ người tham gia
            const bidCount = await Bid.count({ where: { auction_id: auction.id } });
            if (bidCount > 0) {
                return res.status(400).json({ message: 'Không thể xóa phiên đấu giá đã có lượt đặt giá' });
            }

            await AuctionCategory.destroy({ where: { auction_id: auction.id } });
            await auction.destroy();

            res.json({ message: 'Xóa thành công' });
        } catch (err) { next(err); }
    },

    async create(req, res, next) {
        try {
            const { title, description, image, images, starting_price, min_increment, start_time, end_time, category_ids, custom_categories } = req.body;
            const seller_id = req.user.id;

            const startTime = new Date(start_time);
            const endTime = new Date(end_time);

            if (endTime <= startTime) {
                return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
            }

            const initialStatus = computeStatus({ start_time: startTime, end_time: endTime });

            const allImages = images && images.length > 0 ? images : (image ? [image] : []);
            const auction = await Auction.create({
                title,
                description,
                image: allImages.length > 0 ? allImages[0] : null,
                images: allImages,
                starting_price,
                current_price: starting_price,
                min_increment,
                start_time: startTime,
                end_time: endTime,
                seller_id,
                status: initialStatus
            });

            const allCategoryIds = [...(category_ids || [])];

            if (custom_categories && custom_categories.length > 0) {
                for (const name of custom_categories) {
                    let cat = await Category.findOne({ where: { name } });
                    if (!cat) {
                        cat = await Category.create({ name });
                    }
                    allCategoryIds.push(cat.id);
                }
            }

            for (const catId of allCategoryIds) {
                await AuctionCategory.create({ auction_id: auction.id, category_id: catId });
            }

            // Lên lịch tự động mở/đóng phiên qua background job (BullMQ)
            scheduleStart(auction.id, startTime);
            scheduleClose(auction.id, endTime);

            res.status(201).json({ message: 'Đăng bán thành công', id: auction.id });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = AuctionController;
