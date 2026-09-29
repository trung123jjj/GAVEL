const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { REDIS_URL } = require('../config/env');
const { getIO } = require('./io');

let mode = 'in-process';
let queue = null;

const inProcessTimers = new Map();

const QUEUE_NAME = 'auction-jobs';

function parseRedisUrl(url) {
    try {
        const u = new URL(url);
        return {
            host: u.hostname || 'localhost',
            port: Number(u.port || 6379),
            username: u.username || undefined,
            password: u.password || undefined,
            db: Number((u.pathname || '').replace('/', '') || 0)
        };
    } catch {
        return null;
    }
}

function redisOptions() {
    return { ...parseRedisUrl(REDIS_URL), maxRetriesPerRequest: null };
}

async function checkRedis() {
    const probe = new Redis(REDIS_URL, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
        enableOfflineQueue: false
    });
    probe.on('error', () => { /* không log — chỉ dùng để kiểm tra khả dụng */ });
    try {
        await probe.connect();
        await probe.disconnect();
        return true;
    } catch {
        try { probe.disconnect(); } catch { /* noop */ }
        return false;
    }
}

function clearTimer(auctionId) {
    const existing = inProcessTimers.get(auctionId);
    if (existing) {
        clearTimeout(existing);
        inProcessTimers.delete(auctionId);
    }
}

async function closeAuction(auctionId) {
    const { sequelize, Auction, Bid, Order, Notification, User } = require('../models');
    const io = getIO();
    const transaction = await sequelize.transaction();
    try {
        const auction = await Auction.findByPk(auctionId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!auction || auction.status === 'ended') {
            await transaction.rollback();
            return;
        }
        // Nếu thời gian đã được kéo dài (anti-sniping) thì không đóng phiên
        if (new Date(auction.end_time).getTime() > Date.now()) {
            await transaction.rollback();
            return;
        }

        const topBid = await Bid.findOne({
            where: { auction_id: auctionId },
            include: [{ model: User, as: 'bidder', attributes: ['id', 'username'] }],
            order: [['amount', 'DESC'], ['created_at', 'ASC']],
            transaction
        });

        await auction.update({ status: 'ended' }, { transaction });

        let winner = null;
        let finalPrice = Number(auction.current_price);

        if (topBid) {
            winner = { id: topBid.user_id, username: topBid.bidder?.username || 'N/A' };
            finalPrice = Number(topBid.amount);

            const [order, created] = await Order.findOrCreate({
                where: { auction_id: auctionId },
                defaults: {
                    auction_id: auctionId,
                    seller_id: auction.seller_id,
                    buyer_id: topBid.user_id,
                    amount: topBid.amount,
                    status: 'pending'
                },
                transaction
            });
            if (created) {
                console.log(`[scheduler] Order #${order.id} created for auction #${auctionId}`);
            }

            await Notification.bulkCreate([
                {
                    user_id: auction.seller_id,
                    type: 'auction_closed',
                    title: 'Phiên đấu giá đã kết thúc',
                    message: `Phiên "${auction.title}" kết thúc. Người thắng: ${winner.username} với giá ${finalPrice.toLocaleString('vi-VN')}đ`,
                    auction_id: auctionId
                },
                {
                    user_id: topBid.user_id,
                    type: 'won',
                    title: 'Chúc mừng! Bạn đã thắng đấu giá',
                    message: `Bạn đã thắng phiên "${auction.title}" với giá ${finalPrice.toLocaleString('vi-VN')}đ`,
                    auction_id: auctionId
                }
            ], { transaction });
        }

        await transaction.commit();

        io?.to(`auction_${auctionId}`).emit('auction:ended', {
            auctionId: Number(auctionId),
            endTime: auction.end_time,
            winner,
            finalPrice
        });

        console.log(`[scheduler] Closed auction #${auctionId}${winner ? ` — winner ${winner.username} (${finalPrice.toLocaleString('vi-VN')}đ)` : ' (không có bid)'}`);
    } catch (err) {
        await transaction.rollback().catch(() => {});
        console.error('[scheduler] closeAuction error:', err.message);
        throw err;
    }
}

async function startAuction(auctionId) {
    const { sequelize, Auction } = require('../models');
    const io = getIO();
    const transaction = await sequelize.transaction();
    try {
        const auction = await Auction.findByPk(auctionId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!auction || auction.status === 'ended') {
            await transaction.rollback();
            return;
        }
        if (new Date(auction.start_time).getTime() > Date.now()) {
            await transaction.rollback();
            return;
        }
        if (new Date(auction.end_time).getTime() <= Date.now()) {
            await transaction.rollback();
            return;
        }
        await auction.update({ status: 'active' }, { transaction });
        await transaction.commit();
        io?.to(`auction_${auctionId}`).emit('auction:update', { auctionId: Number(auctionId), status: 'active' });
        console.log(`[scheduler] Auction #${auctionId} started`);
    } catch (err) {
        await transaction.rollback().catch(() => {});
        console.error('[scheduler] startAuction error:', err.message);
    }
}

async function notifyOutbid(auctionId, newBidderId, newAmount) {
    const { Bid, Notification, Auction } = require('../models');
    const { Op } = require('sequelize');
    try {
        const prevBidders = await Bid.findAll({
            where: { auction_id: auctionId, user_id: { [Op.ne]: newBidderId } },
            attributes: ['user_id'],
            group: ['user_id'],
            raw: true
        });
        const auction = await Auction.findByPk(auctionId, { attributes: ['title'] });
        if (!auction || prevBidders.length === 0) return;

        const payload = prevBidders.map((b) => ({
            user_id: b.user_id,
            type: 'outbid',
            title: 'Bạn đã bị vượt giá',
            message: `Giá mới cho "${auction.title}" là ${Number(newAmount).toLocaleString('vi-VN')}đ. Đặt giá lại để giữ vị thế!`,
            auction_id: auctionId
        }));
        await Notification.bulkCreate(payload);
        console.log(`[scheduler] Notified ${payload.length} outbid user(s) for auction #${auctionId}`);
    } catch (err) {
        console.error('[scheduler] notifyOutbid error:', err.message);
    }
}

function scheduleInProcessClose(auctionId, endTime) {
    const delay = Math.max(0, new Date(endTime).getTime() - Date.now());
    clearTimer(auctionId);
    const timer = setTimeout(async () => {
        inProcessTimers.delete(auctionId);
        try { await closeAuction(auctionId); } catch { /* handled */ }
    }, delay);
    inProcessTimers.set(auctionId, timer);
}

function scheduleInProcessStart(auctionId, startTime) {
    const delay = Math.max(0, new Date(startTime).getTime() - Date.now());
    const timer = setTimeout(async () => {
        inProcessTimers.delete(`start-${auctionId}`);
        try { await startAuction(auctionId); } catch { /* handled */ }
    }, delay);
    inProcessTimers.set(`start-${auctionId}`, timer);
}

async function enqueueBullmq(name, data, at) {
    const jobId = `${name}-${data.auctionId}`;
    const delay = Math.max(0, new Date(at).getTime() - Date.now());
    try { await queue.remove(jobId); } catch { /* chưa tồn tại */ }
    await queue.add(name, data, { jobId, delay, removeOnComplete: 500, attempts: 5, backoff: { type: 'exponential', delay: 5000 } });
}

function scheduleClose(auctionId, endTime) {
    if (mode === 'bullmq') {
        enqueueBullmq('close-auction', { auctionId }, endTime).catch((err) => {
            console.error('[scheduler] enqueue close-auction error:', err.message);
        });
    } else {
        scheduleInProcessClose(auctionId, endTime);
    }
}

function scheduleStart(auctionId, startTime) {
    if (mode === 'bullmq') {
        enqueueBullmq('start-auction', { auctionId }, startTime).catch((err) => {
            console.error('[scheduler] enqueue start-auction error:', err.message);
        });
    } else {
        scheduleInProcessStart(auctionId, startTime);
    }
}

function enqueueOutbid(auctionId, newBidderId, newAmount) {
    if (mode === 'bullmq') {
        queue.add('notify-outbid', { auctionId, newBidderId, newAmount }, { removeOnComplete: 500, attempts: 3 }).catch((err) => {
            console.error('[scheduler] enqueue notify-outbid error:', err.message);
        });
    } else {
        setImmediate(() => notifyOutbid(auctionId, newBidderId, newAmount));
    }
}

async function initScheduler() {
    const available = await checkRedis();
    if (available) {
        try {
            const connection = redisOptions();
            queue = new Queue(QUEUE_NAME, { connection });
            queue.on('error', (err) => console.error('[scheduler] BullMQ queue error:', err.message));

            const worker = new Worker(
                QUEUE_NAME,
                async (job) => {
                    if (job.name === 'close-auction') await closeAuction(job.data.auctionId);
                    if (job.name === 'start-auction') await startAuction(job.data.auctionId);
                    if (job.name === 'notify-outbid') await notifyOutbid(job.data.auctionId, job.data.newBidderId, job.data.newAmount);
                },
                { connection }
            );
            worker.on('failed', (job, err) => console.error(`[scheduler] job ${job?.name}#${job?.data?.auctionId} failed:`, err.message));
            worker.on('error', (err) => console.error('[scheduler] BullMQ worker error:', err.message));
            mode = 'bullmq';
            console.log('[scheduler] Redis connected — dùng BullMQ cho background jobs.');
        } catch (err) {
            queue = null;
            mode = 'in-process';
            console.warn(`[scheduler] Khởi tạo BullMQ thất bại (${err.message}). Dùng bộ lập lịch in-process.`);
        }
    } else {
        console.warn('[scheduler] Redis không khả dụng — dùng bộ lập lịch in-process (không phải BullMQ).');
    }
}

// Chạy lúc khởi động server: đóng phiên quá hạn và lên lịch cho các phiên còn hoạt động
async function rescheduleAllActiveAuctions() {
    const { Auction, sequelize } = require('../models');
    const { Op } = require('sequelize');
    const now = Date.now();
    const auctions = await Auction.findAll({
        where: { status: { [Op.in]: ['pending', 'active'] } },
        attributes: ['id', 'start_time', 'end_time', 'status']
    });

    for (const a of auctions) {
        const start = new Date(a.start_time).getTime();
        const end = new Date(a.end_time).getTime();

        if (end <= now) {
            setTimeout(() => closeAuction(a.id).catch(() => {}), 200);
        } else if (start <= now) {
            // Phiên đang trong khoảng chạy — nếu DB status còn 'pending' thì mở luôn
            if (a.status === 'pending') {
                setTimeout(() => startAuction(a.id).catch(() => {}), 200);
            }
            scheduleClose(a.id, a.end_time);
        } else {
            scheduleStart(a.id, a.start_time);
            scheduleClose(a.id, a.end_time);
        }
    }
    console.log(`[scheduler] Đã lên lịch đóng/mở cho ${auctions.length} phiên đấu giá.`);
}

module.exports = {
    initScheduler,
    rescheduleAllActiveAuctions,
    scheduleClose,
    scheduleStart,
    enqueueOutbid,
    closeAuction,
    startAuction,
    notifyOutbid,
    getMode: () => mode
};
