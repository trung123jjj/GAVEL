const { Auction, AuctionReport } = require('../models');

const allowedReasons = ['inappropriate', 'fraud', 'prohibited', 'misleading', 'other'];

const AuctionReportController = {
    async create(req, res, next) {
        try {
            const auctionId = Number(req.params.id);
            const reporterId = Number(req.user.id);
            const { reason, details = '' } = req.body;
            if (!Number.isSafeInteger(auctionId) || auctionId <= 0
                || !allowedReasons.includes(reason)
                || typeof details !== 'string'
                || details.trim().length > 1000) {
                return res.status(400).json({ message: 'Thông tin báo cáo không hợp lệ' });
            }

            const auction = await Auction.findOne({
                where: { id: auctionId, removed_at: null },
                attributes: ['id', 'seller_id']
            });
            if (!auction) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            if (Number(auction.seller_id) === reporterId) {
                return res.status(400).json({ message: 'Bạn không thể báo cáo sản phẩm của chính mình' });
            }

            const existing = await AuctionReport.findOne({
                where: { auction_id: auctionId, reporter_id: reporterId },
                attributes: ['id']
            });
            if (existing) {
                return res.status(409).json({ message: 'Bạn đã gửi báo cáo cho sản phẩm này' });
            }

            const report = await AuctionReport.create({
                auction_id: auctionId,
                reporter_id: reporterId,
                reason,
                details: details.trim()
            });
            return res.status(201).json({ message: 'Đã gửi báo cáo cho quản trị viên', id: report.id });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Bạn đã gửi báo cáo cho sản phẩm này' });
            }
            return next(err);
        }
    }
};

module.exports = AuctionReportController;
