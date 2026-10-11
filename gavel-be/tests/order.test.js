const { request, app, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');
const { Auction, Order, Notification } = require('../models');

describe('Auction order workflow', () => {
    let seller;
    let buyer;
    let outsider;
    let auction;
    let order;

    beforeAll(async () => {
        await resetDb();
        seller = await registerUser('order_seller');
        buyer = await registerUser('order_buyer');
        outsider = await registerUser('order_outsider');

        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload());
        auction = await Auction.findByPk(created.body.id);
    });

    beforeEach(async () => {
        order = await Order.create({
            auction_id: auction.id,
            seller_id: seller.user.id,
            buyer_id: buyer.user.id,
            amount: 150000,
            status: 'pending'
        });
    });

    afterEach(async () => {
        await Notification.destroy({ where: { auction_id: auction.id } });
        await Order.destroy({ where: { auction_id: auction.id } });
    });

    test('requires authentication and only lists orders for the current user', async () => {
        const unauthenticated = await request(app).get('/api/orders');
        expect(unauthenticated.status).toBe(401);

        const response = await request(app).get('/api/orders').set(auth(buyer.token));
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
            id: order.id,
            status: 'pending',
            role: 'buyer',
            nextStatus: 'paid',
            auction: { id: auction.id },
            otherUser: { id: seller.user.id, username: seller.user.username }
        });

        const outsiderOrders = await request(app).get('/api/orders').set(auth(outsider.token));
        expect(outsiderOrders.body).toEqual([]);
    });

    test('follows buyer payment, seller shipment, and buyer receipt confirmations', async () => {
        const buyerPayment = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(buyer.token))
            .send({ status: 'paid' });
        expect(buyerPayment.status).toBe(200);
        expect(buyerPayment.body).toMatchObject({ status: 'paid', nextStatus: null });

        const sellerShipment = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(seller.token))
            .send({ status: 'shipped' });
        expect(sellerShipment.status).toBe(200);
        expect(sellerShipment.body).toMatchObject({ status: 'shipped', role: 'seller', nextStatus: null });

        const buyerOrders = await request(app).get('/api/orders').set(auth(buyer.token));
        expect(buyerOrders.body[0]).toMatchObject({ status: 'shipped', nextStatus: 'completed' });

        const buyerReceipt = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(buyer.token))
            .send({ status: 'completed' });
        expect(buyerReceipt.status).toBe(200);
        expect(buyerReceipt.body).toMatchObject({ status: 'completed', nextStatus: null });

        const refreshed = await Order.findByPk(order.id);
        expect(refreshed.status).toBe('completed');
        expect(await Notification.count({ where: { auction_id: auction.id } })).toBe(3);
    });

    test('rejects updates from outsiders, wrong roles, and invalid sequence', async () => {
        const outsiderUpdate = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(outsider.token))
            .send({ status: 'paid' });
        expect(outsiderUpdate.status).toBe(403);

        const sellerPayment = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(seller.token))
            .send({ status: 'paid' });
        expect(sellerPayment.status).toBe(409);

        const invalidStatus = await request(app)
            .patch(`/api/orders/${order.id}/status`)
            .set(auth(buyer.token))
            .send({ status: 'completed' });
        expect(invalidStatus.status).toBe(409);

        expect((await Order.findByPk(order.id)).status).toBe('pending');
        expect(await Notification.count({ where: { auction_id: auction.id } })).toBe(0);
    });
});
