const { Op } = require('sequelize');
const { AuctionReport, Auction, User, sequelize } = require('../models');

const AdminReportController = {
    async list(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const status = req.query.status || 'pending';
            if (!['pending', 'resolved', 'dismissed', 'all'].includes(status)) {
                return res.status(400).json({ message: 'Bộ lọc báo cáo không hợp lệ' });
            }

            const where = {};
            if (status !== 'all') where.status = status;
            if (req.query.q && typeof req.query.q === 'string') {
                const term = req.query.q.trim();
                if (term) where[Op.or] = [{ details: { [Op.like]: `%${term}%` } }];
            }

            const { rows, count } = await AuctionReport.findAndCountAll({
                where,
                include: [
                    { model: Auction, as: 'auction', attributes: ['id', 'title', 'image', 'removed_at', 'removal_reason'] },
                    { model: User, as: 'reporter', attributes: ['id', 'username'] }
                ],
                order: [['createdAt', 'DESC'], ['id', 'DESC']],
                limit,
                offset: (page - 1) * limit
            });

            return res.json({
                reports: rows.map((report) => ({
                    id: report.id,
                    reason: report.reason,
                    details: report.details,
                    status: report.status,
                    createdAt: report.createdAt,
                    auction: report.auction ? {
                        id: report.auction.id,
                        title: report.auction.title,
                        image: report.auction.image,
                        removedAt: report.auction.removed_at,
                        removalReason: report.auction.removal_reason
                    } : null,
                    reporter: report.reporter ? {
                        id: report.reporter.id,
                        username: report.reporter.username
                    } : null
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

    async updateStatus(req, res, next) {
        const reportId = Number(req.params.id);
        const { status } = req.body;
        if (!Number.isSafeInteger(reportId) || reportId <= 0 || !['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Mã hoặc trạng thái báo cáo không hợp lệ' });
        }

        const transaction = await sequelize.transaction();
        try {
            const report = await AuctionReport.findByPk(reportId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!report) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy báo cáo' });
            }
            await report.update({ status }, { transaction });
            await transaction.commit();
            return res.json({ id: report.id, status: report.status });
        } catch (err) {
            await transaction.rollback().catch(() => {});
            return next(err);
        }
    }
};

module.exports = AdminReportController;
