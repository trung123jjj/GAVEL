const { request, app, sequelize, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');
const { Auction, Order } = require('../models');

describe('Review (ràng buộc giao dịch thực)', () => {
    let sellerToken;
    let buyerToken;
    let sellerId;
    let buyerId;
    let auctionId;

    beforeAll(async () => {
        await resetDb();
        const seller = await registerUser('seller_review');
        const buyer = await registerUser('buyer_review');
        sellerToken = seller.token;
        buyerToken = buyer.token;
        sellerId = seller.user.id;
        buyerId = buyer.user.id;

        const created = await request(app)
            .post('/api/auctions')
            .set(auth(sellerToken))
            .send(activeAuctionPayload());
        auctionId = created.body.id;
    });

    test('không thể đánh giá khi chưa có giao dịch hoàn tất', async () => {
        const res = await request(app)
            .post(`/api/reviews/user/${sellerId}`)
            .set(auth(buyerToken))
            .send({ rating: 5, comment: 'Tốt' });
        expect(res.status).toBe(403);
    });

    test('đánh giá thành công khi đã có giao dịch (người thắng phiên)', async () => {
        await Order.create({
            auction_id: auctionId,
            seller_id: sellerId,
            buyer_id: buyerId,
            amount: 200000,
            status: 'completed'
        });

        const res = await request(app)
            .post(`/api/reviews/user/${sellerId}`)
            .set(auth(buyerToken))
            .send({ rating: 5, comment: 'Giao dịch tốt' });
        expect(res.status).toBe(201);
        expect(res.body.auctionId).toBe(auctionId);
    });

    test('mỗi giao dịch chỉ được đánh giá một lần', async () => {
        const res = await request(app)
            .post(`/api/reviews/user/${sellerId}`)
            .set(auth(buyerToken))
            .send({ rating: 4, comment: 'Lần hai' });
        expect(res.status).toBe(400);
    });

    test('không thể tự đánh giá chính mình', async () => {
        const res = await request(app)
            .post(`/api/reviews/user/${sellerId}`)
            .set(auth(sellerToken))
            .send({ rating: 5, comment: 'Tự khen' });
        expect(res.status).toBe(400);
    });
});
