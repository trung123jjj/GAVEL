const request = require('supertest');
const { sequelize } = require('../models');
const { app, server } = require('../app');

async function resetDb() {
    await sequelize.sync({ force: true });
}

// API không còn trả token trong body — token nằm trong cookie httpOnly.
// Test vẫn dùng header Bearer (middleware chấp nhận cả hai) nên lấy giá trị
// cookie ra để gắn vào header.
function accessTokenFrom(res) {
    const cookies = res.headers['set-cookie'] || [];
    for (const c of cookies) {
        const match = /^gavel_at=([^;]+)/.exec(c);
        if (match) return decodeURIComponent(match[1]);
    }
    return null;
}

async function registerUser(username, password = 'password123') {
    const res = await request(app)
        .post('/api/auth/register')
        .send({ username, password });
    if (res.status !== 201) {
        throw new Error(`register failed (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return { token: accessTokenFrom(res), user: res.body.user };
}

function auth(token) {
    return { Authorization: `Bearer ${token}` };
}

const now = new Date();

function activeAuctionPayload(overrides = {}) {
    return {
        title: `Sản phẩm test ${Date.now()}`,
        description: 'Mô tả sản phẩm test',
        starting_price: 100000,
        min_increment: 10000,
        start_time: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        ...overrides
    };
}

module.exports = { request, app, server, sequelize, resetDb, registerUser, auth, activeAuctionPayload, accessTokenFrom };
