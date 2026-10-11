const { Server } = require('socket.io');
const { Op } = require('sequelize');
const { Conversation, Message, User } = require('./models');
const { CLIENT_URL } = require('./config/env');
const { setIO } = require('./services/io');
const { verifyToken } = require('./services/tokenService');
const { messageLimiter, conversationLimiter, auctionRoomLimiter } = require('./services/socketRateLimit');

// Chỉ thành viên của hội thoại mới được vào phòng chat — chống đọc tin nhắn chéo.
async function isParticipant(conversationId, userId) {
    const conv = await Conversation.findByPk(conversationId, {
        attributes: ['id', 'user1_id', 'user2_id']
    });
    if (!conv) return false;
    const uid = Number(userId);
    return Number(conv.user1_id) === uid || Number(conv.user2_id) === uid;
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx < 0) continue;
        const key = part.slice(0, idx).trim();
        if (!key) continue;
        try {
            out[key] = decodeURIComponent(part.slice(idx + 1).trim());
        } catch {
            out[key] = part.slice(idx + 1).trim();
        }
    }
    return out;
}

/**
 * Xác định danh tính người kết nối.
 *
 * Không bắt buộc đăng nhập: khách chưa đăng nhập vẫn cần theo dõi giá đấu giá
 * realtime, nên socket không từ chối kết nối — chỉ đánh dấu socket là ẩn danh.
 * Các event chat sau đó tự từ chối nếu socket không có danh tính.
 *
 * Nguồn token: header handshake (client non-cookie) hoặc cookie httpOnly.
 */
function resolveIdentity(socket) {
    const raw = socket.handshake.auth?.token
        || parseCookies(socket.request?.headers?.cookie).gavel_at
        || null;
    if (!raw) return null;
    try {
        return verifyToken(raw, 'access');
    } catch {
        return null;
    }
}

function setupSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: CLIENT_URL,
            credentials: true
        }
    });

    setIO(io);

    io.on('connection', (socket) => {
        const user = resolveIdentity(socket);
        const userId = user ? user.id : null;
        socket.userId = userId;

        // Phòng riêng chỉ dành cho người đã đăng nhập.
        if (userId) socket.join(`user_${userId}`);

        // Các event dưới đây đều là dữ liệu riêng tư nên bắt buộc có danh tính.
        const requireAuth = (ack) => {
            if (userId) return true;
            ack && ack({ ok: false, error: 'Cần đăng nhập để thực hiện thao tác này' });
            return false;
        };

        // --- Chat events ---
        socket.on('conversation:join', async (conversationId, ack) => {
            if (!requireAuth(ack)) return;
            if (!conversationId) return;

            if (!conversationLimiter.allow(`${socket.id}:join`)) {
                return ack && ack({ ok: false, error: 'Bạn thao tác quá nhanh. Vui lòng chậm lại.' });
            }

            try {
                if (!(await isParticipant(conversationId, userId))) {
                    return ack && ack({ ok: false, error: 'Không có quyền truy cập hội thoại này' });
                }
                socket.join(`conv_${conversationId}`);
                ack && ack({ ok: true });
            } catch (err) {
                console.error('socket conversation:join error:', err.message);
                ack && ack({ ok: false, error: 'Lỗi truy cập hội thoại' });
            }
        });

        socket.on('conversation:leave', (conversationId) => {
            if (conversationId) socket.leave(`conv_${conversationId}`);
        });

        socket.on('message:send', async (payload, ack) => {
            if (!requireAuth(ack)) return;

            if (!messageLimiter.allow(`${socket.id}:send`)) {
                return ack && ack({
                    ok: false,
                    error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chậm lại.'
                });
            }

            try {
                const { conversationId, content } = payload || {};
                if (!conversationId || !content || !String(content).trim()) {
                    return ack && ack({ ok: false, error: 'Thiếu nội dung tin nhắn' });
                }
                if (String(content).length > 5000) {
                    return ack && ack({ ok: false, error: 'Nội dung tin nhắn quá dài (tối đa 5000 ký tự)' });
                }

                const conv = await Conversation.findByPk(conversationId);
                if (!conv) return ack && ack({ ok: false, error: 'Hội thoại không tồn tại' });
                if (Number(conv.user1_id) !== Number(userId) && Number(conv.user2_id) !== Number(userId)) {
                    return ack && ack({ ok: false, error: 'Không có quyền truy cập hội thoại này' });
                }

                const message = await Message.create({
                    conversation_id: conversationId,
                    sender_id: userId,
                    content: String(content).trim()
                });
                await conv.update({ updatedAt: new Date() });

                const sender = await User.findByPk(userId, { attributes: ['id', 'username', 'avatar'] });
                const data = {
                    id: message.id,
                    conversationId: Number(conversationId),
                    senderId: Number(userId),
                    senderName: sender.username,
                    avatar: sender.avatar || null,
                    content: message.content,
                    read: false,
                    createdAt: message.created_at
                };

                io.to(`conv_${conversationId}`).emit('message:new', data);

                const otherId = Number(conv.user1_id) === Number(userId) ? conv.user2_id : conv.user1_id;
                io.to(`user_${otherId}`).emit('conversation:update', { conversationId: Number(conversationId) });

                ack && ack({ ok: true, data });
            } catch (err) {
                console.error('socket message:send error:', err);
                ack && ack({ ok: false, error: 'Lỗi gửi tin nhắn' });
            }
        });

        socket.on('message:read', async (conversationId) => {
            if (!userId || !conversationId) return;
            if (!conversationLimiter.allow(`${socket.id}:read`)) return;

            try {
                if (!(await isParticipant(conversationId, userId))) return;

                await Message.update(
                    { read: true },
                    { where: { conversation_id: conversationId, sender_id: { [Op.ne]: userId }, read: false } }
                );

                io.to(`conv_${conversationId}`).emit('message:read', {
                    conversationId: Number(conversationId),
                    readerId: Number(userId)
                });
            } catch (err) {
                console.error('socket message:read error:', err);
            }
        });

        // --- Auction realtime events (công khai, khách chưa đăng nhập cũng xem được) ---
        socket.on('auction:join', (auctionId) => {
            if (!auctionId) return;
            if (!auctionRoomLimiter.allow(`${socket.id}:auction`)) return;
            socket.join(`auction_${auctionId}`);
        });

        socket.on('auction:leave', (auctionId) => {
            if (auctionId) socket.leave(`auction_${auctionId}`);
        });
    });

    return io;
}

module.exports = setupSocket;
module.exports.parseCookies = parseCookies;
