const { request, app, resetDb, registerUser, auth, accessTokenFrom, activeAuctionPayload } = require('./helpers');
const { User, Auction, Bid, Order, Notification, AuctionReport } = require('../models');

describe('Admin user management', () => {
    let adminUser;
    let adminToken;
    let regularUser;
    let bidder;

    beforeAll(async () => {
        await resetDb();
        const adminAccount = await registerUser('admin_test');
        adminUser = await User.findByPk(adminAccount.user.id);
        await adminUser.update({ role: 'admin' });
        adminToken = adminAccount.token;
        regularUser = await registerUser('regular_test');
        bidder = await registerUser('auction_bidder');
    });

    test('denies unauthenticated and non-admin access', async () => {
        const unauthenticated = await request(app).get('/api/admin/users');
        expect(unauthenticated.status).toBe(401);

        const nonAdmin = await request(app)
            .get('/api/admin/users')
            .set(auth(regularUser.token));
        expect(nonAdmin.status).toBe(403);
    });

    test('lists users with pagination without exposing credentials', async () => {
        const response = await request(app)
            .get('/api/admin/users?page=1&limit=1')
            .set(auth(adminToken));
        expect(response.status).toBe(200);
        expect(response.body.users).toHaveLength(1);
        expect(response.body.total).toBe(3);
        expect(response.body.users[0]).not.toHaveProperty('password');
        expect(response.body.users[0]).not.toHaveProperty('token_version');
    });

    test('locks user, revokes existing access and refresh sessions, then unlocks', async () => {
        const locked = await request(app)
            .patch(`/api/admin/users/${regularUser.user.id}/status`)
            .set(auth(adminToken))
            .send({ isActive: false });
        expect(locked.status).toBe(200);
        expect(locked.body.user.is_active).toBe(false);

        const oldAccess = await request(app)
            .get('/api/auth/me')
            .set(auth(regularUser.token));
        expect(oldAccess.status).toBe(403);

        const lockedLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: 'regular_test', password: 'password123' });
        expect(lockedLogin.status).toBe(401);

        const unlocked = await request(app)
            .patch(`/api/admin/users/${regularUser.user.id}/status`)
            .set(auth(adminToken))
            .send({ isActive: true });
        expect(unlocked.status).toBe(200);
        expect(unlocked.body.user.is_active).toBe(true);

        const oldAccessAfterUnlock = await request(app)
            .get('/api/auth/me')
            .set(auth(regularUser.token));
        expect(oldAccessAfterUnlock.status).toBe(401);

        const loginAfterUnlock = await request(app)
            .post('/api/auth/login')
            .send({ username: 'regular_test', password: 'password123' });
        expect(loginAfterUnlock.status).toBe(200);
        regularUser.token = accessTokenFrom(loginAfterUnlock);
    });

    test('prevents self-locking and rejects malformed status updates', async () => {
        const selfLock = await request(app)
            .patch(`/api/admin/users/${adminUser.id}/status`)
            .set(auth(adminToken))
            .send({ isActive: false });
        expect(selfLock.status).toBe(400);

        const invalidStatus = await request(app)
            .patch(`/api/admin/users/${regularUser.user.id}/status`)
            .set(auth(adminToken))
            .send({ isActive: 'false' });
        expect(invalidStatus.status).toBe(400);
    });

    test('lists auction moderation data and restricts the endpoint to admins', async () => {
        const seller = await registerUser('admin_auction_seller');
        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload({ title: 'Sản phẩm cần kiểm duyệt' }));

        const denied = await request(app)
            .get('/api/admin/auctions')
            .set(auth(regularUser.token));
        expect(denied.status).toBe(403);

        const response = await request(app)
            .get('/api/admin/auctions?q=kiểm%20duyệt&page=1&limit=10')
            .set(auth(adminToken));
        expect(response.status).toBe(200);
        expect(response.body.auctions).toHaveLength(1);
        expect(response.body.auctions[0]).toMatchObject({
            id: created.body.id,
            title: 'Sản phẩm cần kiểm duyệt',
            bidCount: 0,
            status: 'active',
            seller: { id: seller.user.id, username: seller.user.username }
        });
    });

    test('removes a bid auction from public listings, preserves its history and cancels unfinished order', async () => {
        const seller = await registerUser('moderated_seller');
        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload({ title: 'Sản phẩm vi phạm' }));
        const auction = await Auction.findByPk(created.body.id);
        await Bid.create({ auction_id: auction.id, user_id: bidder.user.id, amount: 150000 });
        const report = await AuctionReport.create({
            auction_id: auction.id,
            reporter_id: bidder.user.id,
            reason: 'fraud',
            details: 'Thông tin có dấu hiệu không chính xác'
        });
        const order = await Order.create({
            auction_id: auction.id,
            seller_id: seller.user.id,
            buyer_id: bidder.user.id,
            amount: 150000,
            status: 'paid'
        });

        const removed = await request(app)
            .delete(`/api/admin/auctions/${auction.id}`)
            .set(auth(adminToken))
            .send({ reason: 'Sản phẩm vi phạm quy định đăng bán' });
        expect(removed.status).toBe(200);
        expect(removed.body.orderStatus).toBe('cancelled');

        await auction.reload();
        await order.reload();
        expect(auction.removed_at).toBeTruthy();
        expect(auction.removed_by).toBe(adminUser.id);
        expect(auction.removal_reason).toBe('Sản phẩm vi phạm quy định đăng bán');
        expect(auction.status).toBe('ended');
        expect(order.status).toBe('cancelled');
        expect((await AuctionReport.findByPk(report.id)).status).toBe('resolved');
        expect(await Bid.count({ where: { auction_id: auction.id } })).toBe(1);
        expect(await Notification.count({ where: { auction_id: auction.id } })).toBe(2);
        const sellerNotification = await Notification.findOne({
            where: { auction_id: auction.id, user_id: seller.user.id }
        });
        expect(sellerNotification).toMatchObject({
            type: 'system',
            title: 'Sản phẩm của bạn đã bị quản trị viên gỡ'
        });
        expect(sellerNotification.message).toContain('Lý do: Sản phẩm vi phạm quy định đăng bán');

        const publicDetail = await request(app).get(`/api/auctions/${auction.id}`);
        expect(publicDetail.status).toBe(404);
        const publicList = await request(app).get(`/api/auctions?ids=${auction.id}`);
        expect(publicList.status).toBe(200);
        expect(publicList.body.total).toBe(0);

        const removedList = await request(app)
            .get('/api/admin/auctions?status=removed')
            .set(auth(adminToken));
        expect(removedList.body.auctions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: auction.id,
                status: 'removed',
                removalReason: 'Sản phẩm vi phạm quy định đăng bán',
                orderStatus: 'cancelled'
            })
        ]));
    });

    test('keeps completed orders unchanged when their auction listing is removed', async () => {
        const seller = await registerUser('completed_seller');
        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload({ title: 'Sản phẩm giao dịch hoàn tất' }));
        const auction = await Auction.findByPk(created.body.id);
        const order = await Order.create({
            auction_id: auction.id,
            seller_id: seller.user.id,
            buyer_id: bidder.user.id,
            amount: 150000,
            status: 'completed'
        });

        const removed = await request(app)
            .delete(`/api/admin/auctions/${auction.id}`)
            .set(auth(adminToken))
            .send({ reason: 'Vi phạm được phát hiện sau giao dịch' });
        expect(removed.status).toBe(200);
        expect(removed.body.orderStatus).toBe('completed');
        await order.reload();
        expect(order.status).toBe('completed');
    });
});
