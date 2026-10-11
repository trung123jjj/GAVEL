const { request, app, resetDb, registerUser, auth } = require('./helpers');
const { User } = require('../models');

describe('Admin user management', () => {
    let adminUser;
    let adminToken;
    let regularUser;

    beforeAll(async () => {
        await resetDb();
        const adminAccount = await registerUser('admin_test');
        adminUser = await User.findByPk(adminAccount.user.id);
        await adminUser.update({ role: 'admin' });
        adminToken = adminAccount.token;
        regularUser = await registerUser('regular_test');
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
        expect(response.body.total).toBe(2);
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
});
