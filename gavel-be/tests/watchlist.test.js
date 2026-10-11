const { request, app, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');

describe('User watchlist', () => {
    let user;
    let otherUser;
    let auctionId;

    beforeAll(async () => {
        await resetDb();
        user = await registerUser('watchlist_user');
        otherUser = await registerUser('watchlist_other');
        const response = await request(app)
            .post('/api/auctions')
            .set(auth(user.token))
            .send(activeAuctionPayload());
        expect(response.status).toBe(201);
        auctionId = response.body.id;
    });

    test('persists watchlist items per authenticated user', async () => {
        const addResponse = await request(app)
            .post(`/api/users/watchlist/${auctionId}`)
            .set(auth(user.token));
        expect(addResponse.status).toBe(204);

        const ownWatchlist = await request(app)
            .get('/api/users/watchlist')
            .set(auth(user.token));
        expect(ownWatchlist.body.auctionIds.map(Number)).toContain(Number(auctionId));

        const otherWatchlist = await request(app)
            .get('/api/users/watchlist')
            .set(auth(otherUser.token));
        expect(otherWatchlist.body.auctionIds).toEqual([]);
    });

    test('merges valid legacy local IDs and removes an item', async () => {
        const syncResponse = await request(app)
            .post('/api/users/watchlist/sync')
            .set(auth(user.token))
            .send({ auctionIds: [String(auctionId), '999999'] });
        expect(syncResponse.status).toBe(200);
        expect(syncResponse.body.auctionIds.map(Number)).toContain(Number(auctionId));

        const removeResponse = await request(app)
            .delete(`/api/users/watchlist/${auctionId}`)
            .set(auth(user.token));
        expect(removeResponse.status).toBe(204);

        const watchlist = await request(app)
            .get('/api/users/watchlist')
            .set(auth(user.token));
        expect(watchlist.body.auctionIds.map(Number)).not.toContain(Number(auctionId));
    });

    test('requires authentication and rejects invalid watchlist data', async () => {
        const unauthorized = await request(app).get('/api/users/watchlist');
        expect(unauthorized.status).toBe(401);

        const invalid = await request(app)
            .post('/api/users/watchlist/sync')
            .set(auth(user.token))
            .send({ auctionIds: ['not-an-id'] });
        expect(invalid.status).toBe(400);
    });
});
