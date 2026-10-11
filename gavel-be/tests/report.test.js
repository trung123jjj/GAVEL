const { request, app, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');
const { Auction, AuctionReport, User } = require('../models');

describe('Auction reports', () => {
    let seller;
    let reporter;
    let admin;
    let auction;

    beforeAll(async () => {
        await resetDb();
        seller = await registerUser('report_seller');
        reporter = await registerUser('report_user');
        const adminAccount = await registerUser('report_admin');
        admin = adminAccount;
        await User.update({ role: 'admin' }, { where: { id: adminAccount.user.id } });

        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload({ title: 'Sản phẩm bị báo cáo' }));
        auction = await Auction.findByPk(created.body.id);
    });

    test('requires login, blocks sellers reporting themselves and accepts a valid report once', async () => {
        const unauthenticated = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .send({ reason: 'fraud', details: 'Có dấu hiệu bất thường' });
        expect(unauthenticated.status).toBe(401);

        const selfReport = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .set(auth(seller.token))
            .send({ reason: 'fraud', details: 'Tự báo cáo' });
        expect(selfReport.status).toBe(400);

        const created = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .set(auth(reporter.token))
            .send({ reason: 'fraud', details: 'Thông tin sản phẩm có vẻ không đúng' });
        expect(created.status).toBe(201);

        const duplicate = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .set(auth(reporter.token))
            .send({ reason: 'fraud', details: 'Báo cáo lần hai' });
        expect(duplicate.status).toBe(409);
        expect(await AuctionReport.count({ where: { auction_id: auction.id } })).toBe(1);
    });

    test('admins can review and dismiss reports; regular users cannot access admin reports', async () => {
        const denied = await request(app)
            .get('/api/admin/reports?status=pending')
            .set(auth(reporter.token));
        expect(denied.status).toBe(403);

        const listed = await request(app)
            .get('/api/admin/reports?status=pending')
            .set(auth(admin.token));
        expect(listed.status).toBe(200);
        expect(listed.body.reports).toHaveLength(1);
        const report = listed.body.reports[0];
        expect(report).toMatchObject({
            reason: 'fraud',
            details: 'Thông tin sản phẩm có vẻ không đúng',
            status: 'pending',
            auction: { id: auction.id, title: 'Sản phẩm bị báo cáo' },
            reporter: { id: reporter.user.id, username: reporter.user.username }
        });

        const dismissed = await request(app)
            .patch(`/api/admin/reports/${report.id}/status`)
            .set(auth(admin.token))
            .send({ status: 'dismissed' });
        expect(dismissed.status).toBe(200);
        expect(dismissed.body.status).toBe('dismissed');
        expect((await AuctionReport.findByPk(report.id)).status).toBe('dismissed');
    });

    test('rejects invalid report reason and details', async () => {
        const invalidReason = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .set(auth(seller.token))
            .send({ reason: 'invalid' });
        expect(invalidReason.status).toBe(400);

        const tooLong = await request(app)
            .post(`/api/auctions/${auction.id}/reports`)
            .set(auth(seller.token))
            .send({ reason: 'other', details: 'x'.repeat(1001) });
        expect(tooLong.status).toBe(400);
    });
});
