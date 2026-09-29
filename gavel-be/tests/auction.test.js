const { request, app, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');

describe('Auction & Bid', () => {
    let sellerToken;
    let buyerToken;
    let auctionId;

    beforeAll(async () => {
        await resetDb();
        const seller = await registerUser('seller_1');
        const buyer = await registerUser('buyer_1');
        sellerToken = seller.token;
        buyerToken = buyer.token;
    });

    test('người bán tạo phiên đấu giá thành công', async () => {
        const res = await request(app)
            .post('/api/auctions')
            .set(auth(sellerToken))
            .send(activeAuctionPayload());
        expect(res.status).toBe(201);
        auctionId = res.body.id;
    });

    test('người bán không được đặt giá sản phẩm của chính mình (self-bid)', async () => {
        const res = await request(app)
            .post('/api/bids')
            .set(auth(sellerToken))
            .send({ auction_id: auctionId, amount: 150000 });
        expect(res.status).toBe(403);
    });

    test('đặt giá thấp hơn giá tối thiểu bị từ chối', async () => {
        const res = await request(app)
            .post('/api/bids')
            .set(auth(buyerToken))
            .send({ auction_id: auctionId, amount: 50000 });
        expect(res.status).toBe(400);
    });

    test('đặt giá hợp lệ thành công, giá hiện tại được cập nhật', async () => {
        const res = await request(app)
            .post('/api/bids')
            .set(auth(buyerToken))
            .send({ auction_id: auctionId, amount: 150000 });
        expect(res.status).toBe(201);
        expect(Number(res.body.currentPrice)).toBe(150000);
        expect(res.body.bidCount).toBe(1);

        const detail = await request(app).get(`/api/auctions/${auctionId}`);
        expect(detail.body.currentPrice).toBe(150000);
        expect(detail.body.bidCount).toBe(1);
    });

    test('đặt giá lên phiên đã kết thúc bị từ chối', async () => {
        const res1 = await request(app)
            .post('/api/auctions')
            .set(auth(sellerToken))
            .send(activeAuctionPayload({
                title: 'Phiên đã kết thúc',
                start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() - 60 * 60 * 1000).toISOString()
            }));
        const endedId = res1.body.id;

        const res = await request(app)
            .post('/api/bids')
            .set(auth(buyerToken))
            .send({ auction_id: endedId, amount: 200000 });
        expect(res.status).toBe(400);
    });

    test('xóa phiên đã có lượt đặt giá bị chặn', async () => {
        const res = await request(app)
            .delete(`/api/auctions/${auctionId}`)
            .set(auth(sellerToken));
        expect(res.status).toBe(400);
    });

    test('chưa xác thực không thể đặt giá', async () => {
        const res = await request(app)
            .post('/api/bids')
            .send({ auction_id: auctionId, amount: 200000 });
        expect(res.status).toBe(401);
    });

    test('danh sách phiên có phân trang', async () => {
        const res = await request(app).get('/api/auctions?page=1&limit=5');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(5);
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.totalPages).toBe('number');
    });
});
