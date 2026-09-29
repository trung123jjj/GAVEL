const { resetDb, registerUser, request, app, auth, activeAuctionPayload } = require('./helpers');
const { Auction, Bid, Order, Notification, Review, User } = require('../models');
const { closeAuction, startAuction, notifyOutbid } = require('../services/auctionScheduler');

const MIN = 60 * 1000;

async function makeAuction(seller, overrides = {}) {
    const res = await request(app)
        .post('/api/auctions')
        .set(auth(seller.token))
        .send(activeAuctionPayload(overrides));
    if (res.status !== 201) {
        throw new Error(`create auction failed (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return Auction.findByPk(res.body.id);
}

/**
 * AuctionController tự tính status lúc tạo (đã quá giờ => 'ended'), nên để mô
 * phỏng "thời gian trôi qua" ta tạo phiên ở trạng thái bình thường rồi chỉnh
 * thời gian/status trực tiếp trong DB.
 */
async function makeExpiredAuction(seller, overrides = {}) {
    const auction = await makeAuction(seller, {
        start_time: new Date(Date.now() - 2 * 60 * MIN).toISOString(),
        end_time: new Date(Date.now() + 60 * MIN).toISOString(),
        ...overrides
    });
    await auction.update({
        status: 'active',
        end_time: new Date(Date.now() - MIN)
    });
    return Auction.findByPk(auction.id);
}

describe('Auction scheduler', () => {
    let seller;
    let bidderA;
    let bidderB;

    beforeAll(async () => {
        await resetDb();
        seller = await registerUser('sch_seller');
        bidderA = await registerUser('sch_bidder_a');
        bidderB = await registerUser('sch_bidder_b');
    });

    describe('closeAuction', () => {
        test('đóng phiên hết giờ: tạo order cho người thắng và gửi thông báo', async () => {
            const auction = await makeExpiredAuction(seller);

            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });
            await Bid.create({ auction_id: auction.id, user_id: bidderB.user.id, amount: 150000 });

            await closeAuction(auction.id);

            const closed = await Auction.findByPk(auction.id);
            expect(closed.status).toBe('ended');

            // Người đặt giá cao nhất là người thắng.
            const order = await Order.findOne({ where: { auction_id: auction.id } });
            expect(order).toBeTruthy();
            expect(order.buyer_id).toBe(bidderB.user.id);
            expect(order.seller_id).toBe(seller.user.id);
            expect(Number(order.amount)).toBe(150000);
            expect(order.status).toBe('pending');

            const notes = await Notification.findAll({ where: { auction_id: auction.id } });
            expect(notes.map((n) => n.type).sort()).toEqual(['auction_closed', 'won']);
            expect(notes.find((n) => n.type === 'won').user_id).toBe(bidderB.user.id);
        });

        test('phiên không có bid: kết thúc nhưng không tạo order', async () => {
            const auction = await makeExpiredAuction(seller);

            await closeAuction(auction.id);

            expect((await Auction.findByPk(auction.id)).status).toBe('ended');
            expect(await Order.count({ where: { auction_id: auction.id } })).toBe(0);
        });

        test('gọi lần hai không tạo trùng order (idempotent)', async () => {
            const auction = await makeExpiredAuction(seller);
            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });

            await closeAuction(auction.id);
            await closeAuction(auction.id);

            expect(await Order.count({ where: { auction_id: auction.id } })).toBe(1);
            expect(await Notification.count({ where: { auction_id: auction.id } })).toBe(2);
        });

        test('không đóng phiên còn giờ', async () => {
            const auction = await makeAuction(seller, {
                end_time: new Date(Date.now() + 60 * MIN).toISOString()
            });

            await closeAuction(auction.id);

            const still = await Auction.findByPk(auction.id);
            expect(still.status).not.toBe('ended');
            expect(await Order.count({ where: { auction_id: auction.id } })).toBe(0);
        });

        test('auction_id không tồn tại thì không ném lỗi', async () => {
            await expect(closeAuction(999999)).resolves.toBeUndefined();
        });
    });

    describe('startAuction', () => {
        test('mở phiên khi đã tới giờ bắt đầu', async () => {
            const auction = await makeAuction(seller, {
                start_time: new Date(Date.now() + 60 * MIN).toISOString(),
                end_time: new Date(Date.now() + 120 * MIN).toISOString()
            });
            expect(auction.status).toBe('pending');

            // Đẩo thời gian bắt đầu về quá khứ, giữ kết thúc ở tương lai.
            await auction.update({ start_time: new Date(Date.now() - MIN) });

            await startAuction(auction.id);

            expect((await Auction.findByPk(auction.id)).status).toBe('active');
        });

        test('không mở phiên chưa tới giờ', async () => {
            const auction = await makeAuction(seller, {
                start_time: new Date(Date.now() + 60 * MIN).toISOString(),
                end_time: new Date(Date.now() + 120 * MIN).toISOString()
            });

            await startAuction(auction.id);

            expect((await Auction.findByPk(auction.id)).status).toBe('pending');
        });

        test('không mở phiên đã quá giờ kết thúc', async () => {
            const auction = await makeAuction(seller, {
                start_time: new Date(Date.now() + 60 * MIN).toISOString(),
                end_time: new Date(Date.now() + 120 * MIN).toISOString()
            });
            expect(auction.status).toBe('pending');

            // Cả start và end đều nằm trong quá khứ. startAuction phải từ chối
            // mở phiên — việc kết thúc phiên là của closeAuction.
            await auction.update({
                start_time: new Date(Date.now() - 120 * MIN),
                end_time: new Date(Date.now() - MIN)
            });

            await startAuction(auction.id);

            expect((await Auction.findByPk(auction.id)).status).toBe('pending');
        });
    });

    describe('notifyOutbid', () => {
        test('chỉ thông báo cho người bị vượt giá', async () => {
            const auction = await makeAuction(seller);

            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });
            await Bid.create({ auction_id: auction.id, user_id: bidderB.user.id, amount: 200000 });

            await notifyOutbid(auction.id, bidderB.user.id, 200000);

            const notes = await Notification.findAll({ where: { auction_id: auction.id, type: 'outbid' } });
            const recipients = notes.map((n) => n.user_id);

            expect(recipients).toContain(bidderA.user.id);
            expect(recipients).not.toContain(bidderB.user.id);
            expect(recipients).not.toContain(seller.user.id);
        });

        test('người bị vượt nhiều lần chỉ nhận 1 thông báo', async () => {
            const auction = await makeAuction(seller);

            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });
            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 150000 });

            await notifyOutbid(auction.id, bidderB.user.id, 300000);

            const notes = await Notification.findAll({ where: { auction_id: auction.id, type: 'outbid' } });
            expect(notes).toHaveLength(1);
            expect(notes[0].user_id).toBe(bidderA.user.id);
        });

        test('phiên chưa có ai đặt giá thì không tạo thông báo', async () => {
            const auction = await makeAuction(seller);

            await notifyOutbid(auction.id, bidderA.user.id, 100000);

            expect(await Notification.count({ where: { auction_id: auction.id, type: 'outbid' } })).toBe(0);
        });
    });

    describe('anti-sniping', () => {
        test('đặt giá trong 2 phút cuối kéo dài phiên thêm đúng 2 phút', async () => {
            const auction = await makeAuction(seller, {
                end_time: new Date(Date.now() + MIN).toISOString()
            });
            const originalEnd = new Date(auction.end_time).getTime();

            const res = await request(app)
                .post('/api/bids')
                .set(auth(bidderA.token))
                .send({ auction_id: auction.id, amount: Number(auction.starting_price) + 10000 });

            expect(res.status).toBe(201);

            const updated = await Auction.findByPk(auction.id);
            const newEnd = new Date(updated.end_time).getTime();
            expect(newEnd - originalEnd).toBe(120000);
        });

        test('đặt giá sớm không kéo dài phiên', async () => {
            const auction = await makeAuction(seller, {
                end_time: new Date(Date.now() + 60 * MIN).toISOString()
            });
            const originalEnd = new Date(auction.end_time).getTime();

            await request(app)
                .post('/api/bids')
                .set(auth(bidderA.token))
                .send({ auction_id: auction.id, amount: Number(auction.starting_price) + 10000 });

            expect(new Date((await Auction.findByPk(auction.id)).end_time).getTime()).toBe(originalEnd);
        });
    });

    describe('ràng buộc dữ liệu', () => {
        test('mỗi phiên chỉ có tối đa một order', async () => {
            const auction = await makeExpiredAuction(seller);
            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });
            await closeAuction(auction.id);

            await expect(Order.create({
                auction_id: auction.id,
                seller_id: seller.user.id,
                buyer_id: bidderB.user.id,
                amount: 999
            })).rejects.toBeTruthy();
        });

        test('mỗi giao dịch chỉ được đánh giá một lần', async () => {
            const auction = await makeExpiredAuction(seller);
            await Bid.create({ auction_id: auction.id, user_id: bidderA.user.id, amount: 100000 });
            await closeAuction(auction.id);
            const order = await Order.findOne({ where: { auction_id: auction.id } });

            const review = {
                user_id: seller.user.id,
                buyer_id: order.buyer_id,
                order_id: order.id,
                rating: 5,
                comment: 'giao dịch tốt'
            };

            await expect(Review.create(review)).resolves.toBeTruthy();
            await expect(Review.create(review)).rejects.toBeTruthy();
        });

        test('token_version mặc định là 0 và tăng được khi thu hồi phiên', async () => {
            const user = await User.findByPk(bidderA.user.id);
            expect(user.token_version).toBe(0);

            await user.update({ token_version: user.token_version + 1 });

            expect((await User.findByPk(bidderA.user.id)).token_version).toBe(1);
        });
    });
});
