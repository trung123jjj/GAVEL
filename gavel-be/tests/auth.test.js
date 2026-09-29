const { request, app, resetDb, registerUser, accessTokenFrom, auth } = require('./helpers');

function cookieNamed(res, name) {
    const cookies = res.headers['set-cookie'] || [];
    return cookies.find((c) => c.startsWith(`${name}=`)) || null;
}

describe('Auth', () => {
    beforeAll(async () => { await resetDb(); });

    test('đăng ký thành công và thiết lập cookie httpOnly thay vì trả token', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'user_auth_1', password: 'secret123' });

        expect(res.status).toBe(201);
        expect(res.body.user.username).toBe('user_auth_1');

        // Không rò token ra body (tránh bị đánh cắp qua XSS).
        expect(res.body.token).toBeUndefined();

        const access = cookieNamed(res, 'gavel_at');
        const refresh = cookieNamed(res, 'gavel_rt');
        expect(access).toBeTruthy();
        expect(refresh).toBeTruthy();
        expect(access).toMatch(/HttpOnly/i);
        expect(refresh).toMatch(/HttpOnly/i);

        // Refresh cookie chỉ gửi cho /api/auth để giảm bề mặt bị lộ.
        expect(refresh).toMatch(/Path=\/api\/auth/i);
    });

    test('đăng ký username trùng lặp bị từ chối', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'user_auth_1', password: 'secret123' });
        expect(res.status).toBe(400);
    });

    test('đăng nhập đúng mật khẩu thiết lập cookie phiên', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'user_auth_1', password: 'secret123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeUndefined();
        expect(accessTokenFrom(res)).toBeTruthy();
    });

    test('đăng nhập sai mật khẩu bị từ chối', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'user_auth_1', password: 'sai_mat_khau' });
        expect(res.status).toBe(401);
    });

    test('validate: username/password quá ngắn bị từ chối', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'ab', password: '123' });
        expect(res.status).toBe(400);
    });

    test('cookie phiên được chấp nhận cho request cần xác thực', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ username: 'user_auth_1', password: 'secret123' });
        const token = accessTokenFrom(login);

        const me = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `gavel_at=${encodeURIComponent(token)}`);

        expect(me.status).toBe(200);
        expect(me.body.user.username).toBe('user_auth_1');
    });

    test('refresh cấp lại access token mới từ refresh cookie', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ username: 'user_auth_1', password: 'secret123' });

        const refreshCookie = cookieNamed(login, 'gavel_rt');
        const value = decodeURIComponent(/^gavel_rt=([^;]+)/.exec(refreshCookie)[1]);

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `gavel_rt=${encodeURIComponent(value)}`);

        expect(res.status).toBe(200);
        expect(res.body.user.username).toBe('user_auth_1');
        expect(accessTokenFrom(res)).toBeTruthy();
    });

    test('refresh bị từ chối khi không có refresh cookie', async () => {
        const res = await request(app).post('/api/auth/refresh');
        expect(res.status).toBe(401);
    });

    test('refresh token không dùng được như access token (chống nhầm loại)', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ username: 'user_auth_1', password: 'secret123' });
        const refreshValue = decodeURIComponent(/^gavel_rt=([^;]+)/.exec(cookieNamed(login, 'gavel_rt'))[1]);

        // Nhét refresh token vào header Bearer của access token.
        const me = await request(app)
            .get('/api/auth/me')
            .set(auth(refreshValue));

        expect(me.status).toBe(401);
    });

    test('logout xoá cookie phiên', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(200);
        const cleared = cookieNamed(res, 'gavel_at');
        expect(cleared).toMatch(/gavel_at=;/);
    });

    test('/api/auth/me từ chối khi không đăng nhập', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    test('đăng ký qua helper vẫn lấy được token để test dùng header Bearer', async () => {
        const { token, user } = await registerUser('user_auth_helper');
        expect(token).toBeTruthy();
        expect(user.username).toBe('user_auth_helper');
    });
});
