const { io } = require('socket.io-client');
const { request, app, server, resetDb, registerUser, auth, activeAuctionPayload } = require('./helpers');
const { messageLimiter, conversationLimiter, auctionRoomLimiter } = require('../services/socketRateLimit');
const { signAccessToken } = require('../services/tokenService');
const { Conversation, User } = require('../models');
const parseCookies = require('../socket').parseCookies;

let baseUrl;
let anonymous;

function connect(opts = {}) {
    return new Promise((resolve, reject) => {
        const socket = io(baseUrl, { transports: ['websocket'], forceNew: true, ...opts });
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('socket connect timeout'));
        }, 5000);
        socket.on('connect', () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.on('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function emit(socket, event, payload) {
    return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function waitFor(socket, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeout);
        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

// conversations có unique index trên (user1_id, user2_id) nên phải tìm hoặc tạo mới
// thay vì create lại mỗi lần.
async function conversationBetween(a, b) {
    const [u1, u2] = a < b ? [a, b] : [b, a];
    const [conv] = await Conversation.findOrCreate({
        where: { user1_id: u1, user2_id: u2 },
        defaults: { user1_id: u1, user2_id: u2 }
    });
    return conv;
}

describe('Socket realtime', () => {
    let seller;
    let bidder;

    beforeAll(async () => {
        await resetDb();
        await new Promise((resolve) => server.listen(0, resolve));
        baseUrl = `http://localhost:${server.address().port}`;

        seller = await registerUser('sock_seller');
        bidder = await registerUser('sock_bidder');
    });

    afterAll(async () => {
        anonymous?.close();
        await new Promise((resolve) => server.close(resolve));
    });

    beforeEach(() => {
        // Rate limiter là singleton dùng chung cho cả suite.
        messageLimiter.reset();
        conversationLimiter.reset();
        auctionRoomLimiter.reset();
    });

    describe('parseCookies', () => {
        test('tách cookie từ header', () => {
            expect(parseCookies('a=1; gavel_at=abc.def; b=2')).toEqual({ a: '1', gavel_at: 'abc.def', b: '2' });
        });

        test('giải mã giá trị đã url-encode', () => {
            expect(parseCookies('gavel_at=a%20b').gavel_at).toBe('a b');
        });

        test('header rỗng hoặc thiếu dấu = không vỡ', () => {
            expect(parseCookies('')).toEqual({});
            expect(parseCookies(undefined)).toEqual({});
            expect(parseCookies('broken')).toEqual({});
        });
    });

    test('khách chưa đăng nhập vẫn kết nối được (để xem giá realtime)', async () => {
        anonymous = await connect();
        expect(anonymous.connected).toBe(true);
        anonymous.close();
    });

    test('khách ẩn danh nhận được bid:new của phiên đang theo dõi', async () => {
        const created = await request(app)
            .post('/api/auctions')
            .set(auth(seller.token))
            .send(activeAuctionPayload({ title: 'Phiên realtime' }));
        expect(created.status).toBe(201);
        const auctionId = created.body.id;

        const watcher = await connect();
        const bidEvent = waitFor(watcher, 'bid:new');

        watcher.emit('auction:join', String(auctionId));
        // Chờ server xử lý join trước khi đặt giá.
        await new Promise((r) => setTimeout(r, 150));

        const bid = await request(app)
            .post('/api/bids')
            .set(auth(bidder.token))
            .send({ auction_id: auctionId, amount: 150000 });
        expect(bid.status).toBe(201);

        const payload = await bidEvent;
        expect(payload.auctionId).toBe(auctionId);
        expect(Number(payload.currentPrice)).toBe(150000);
        expect(payload.bidder.id).toBe(bidder.user.id);

        watcher.close();
    });

    test('socket ẩn danh bị từ chối gửi tin nhắn', async () => {
        const guest = await connect();
        const ack = await emit(guest, 'message:send', { conversationId: 1, content: 'xin chào' });

        expect(ack.ok).toBe(false);
        expect(ack.error).toMatch(/đăng nhập/i);
        guest.close();
    });

    test('socket ẩn danh bị từ chối join phòng chat', async () => {
        const guest = await connect();
        const ack = await emit(guest, 'conversation:join', 1);

        expect(ack.ok).toBe(false);
        expect(ack.error).toMatch(/đăng nhập/i);
        guest.close();
    });

    test('người dùng không thuộc hội thoại không vào được phòng chat', async () => {
        // user1 < user2 để khớp với quy ước sắp xếp trong ChatController.
        const outsider = await registerUser('sock_outsider');
        const conversation = await conversationBetween(seller.user.id, bidder.user.id);

        const socket = await connect({ auth: { token: signAccessToken(outsider.user) } });
        const ack = await emit(socket, 'conversation:join', conversation.id);

        expect(ack.ok).toBe(false);
        expect(ack.error).toMatch(/quyền/i);

        // Bảo đảm socket không nhận được tin nhắn của hội thoại đó.
        let leaked = false;
        socket.on('message:new', () => { leaked = true; });
        await request(app)
            .post('/api/chat/messages')
            .set(auth(seller.token))
            .send({ conversation_id: conversation.id, content: 'tin nhắn riêng' });
        await new Promise((r) => setTimeout(r, 250));

        expect(leaked).toBe(false);
        socket.close();
    });

    test('thành viên hội thoại vào được phòng và nhận message:new', async () => {
        const conversation = await conversationBetween(seller.user.id, bidder.user.id);

        const a = await connect({ auth: { token: signAccessToken(seller.user) } });
        const b = await connect({ auth: { token: signAccessToken(bidder.user) } });

        const ackA = await emit(a, 'conversation:join', conversation.id);
        expect(ackA.ok).toBe(true);

        // Cả hai đều phải ở trong phòng thì mới nhận được broadcast.
        const ackB = await emit(b, 'conversation:join', conversation.id);
        expect(ackB.ok).toBe(true);

        const received = waitFor(b, 'message:new');
        const sendAck = await emit(a, 'message:send', { conversationId: conversation.id, content: 'chào bạn' });
        expect(sendAck.ok).toBe(true);

        const msg = await received;
        expect(msg.content).toBe('chào bạn');
        expect(msg.senderId).toBe(seller.user.id);

        a.close();
        b.close();
    });

    test('đăng nhập qua cookie httpOnly cũng xác thực được socket', async () => {
        const user = await User.findByPk(bidder.user.id);
        const token = signAccessToken(user);

        const socket = await connect({ extraHeaders: { Cookie: `gavel_at=${encodeURIComponent(token)}` } });

        const ack = await emit(socket, 'conversation:join', 999999);
        // Không có hội thoại nào id 999999 nên vẫn bị từ chối, nhưng phải qua
        // được bước kiểm tra danh tính (không phải lỗi "cần đăng nhập").
        expect(ack.ok).toBe(false);
        expect(ack.error).not.toMatch(/đăng nhập/i);

        socket.close();
    });

    test('spam tin nhắn bị chặn bởi rate limit', async () => {
        const conversation = await conversationBetween(seller.user.id, bidder.user.id);
        const socket = await connect({ auth: { token: signAccessToken(seller.user) } });

        // messageLimiter cho phép 20 lần / 10 giây.
        const acks = [];
        for (let i = 0; i < 24; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            acks.push(await emit(socket, 'message:send', {
                conversationId: conversation.id,
                content: `tin ${i}`
            }));
        }

        const allowed = acks.filter((a) => a.ok).length;
        const blocked = acks.filter((a) => !a.ok && /nhanh/i.test(a.error || ''));

        expect(allowed).toBe(20);
        expect(blocked.length).toBe(4);

        socket.close();
    });

    test('nội dung tin nhắn quá dài bị từ chối', async () => {
        const conversation = await conversationBetween(seller.user.id, bidder.user.id);
        const socket = await connect({ auth: { token: signAccessToken(seller.user) } });

        const ack = await emit(socket, 'message:send', {
            conversationId: conversation.id,
            content: 'x'.repeat(5001)
        });

        expect(ack.ok).toBe(false);
        expect(ack.error).toMatch(/dài/i);
        socket.close();
    });
});
