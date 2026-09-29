const { Conversation, Message, User } = require('../models');
const { Op } = require('sequelize');

const ChatController = {
    async getConversations(req, res, next) {
        try {
            const me = Number(req.user.id);

            const conversations = await Conversation.findAll({
                where: {
                    [Op.or]: [{ user1_id: me }, { user2_id: me }]
                },
                include: [
                    { model: User, as: 'user1', attributes: ['id', 'username', 'avatar'] },
                    { model: User, as: 'user2', attributes: ['id', 'username', 'avatar'] },
                    {
                        model: Message,
                        as: 'messages',
                        include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'avatar'] }],
                        order: [['created_at', 'DESC'], ['id', 'DESC']],
                        limit: 1
                    }
                ],
                order: [['updated_at', 'DESC']]
            });

            const result = await Promise.all(conversations.map(async (c) => {
                const other = Number(c.user1_id) === me ? c.user2 : c.user1;
                const lastMessage = c.messages?.[0] || null;
                const unreadCount = await Message.count({
                    where: { conversation_id: c.id, sender_id: { [Op.ne]: me }, read: false }
                });

                return {
                    id: c.id,
                    otherUser: { id: other.id, username: other.username, avatar: other.avatar || null },
                    lastMessage: lastMessage ? {
                        id: lastMessage.id,
                        senderId: lastMessage.sender_id,
                        senderName: lastMessage.sender?.username || '',
                        avatar: lastMessage.sender?.avatar || null,
                        content: lastMessage.content,
                        read: lastMessage.read,
                        createdAt: lastMessage.created_at
                    } : null,
                    unreadCount,
                    updatedAt: c.updated_at
                };
            }));

            res.json(result);
        } catch (err) { next(err); }
    },

    async getOrCreateConversation(req, res, next) {
        try {
            const me = Number(req.user.id);
            const otherId = Number(req.params.userId);

            if (!otherId) {
                return res.status(400).json({ message: 'Thiếu id người dùng' });
            }
            if (me === otherId) {
                return res.status(400).json({ message: 'Không thể nhắn tin cho chính mình' });
            }

            const other = await User.findByPk(otherId, { attributes: ['id', 'username', 'avatar'] });
            if (!other) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }

            const [u1, u2] = otherId < me ? [otherId, me] : [me, otherId];

            const [conversation] = await Conversation.findOrCreate({
                where: { user1_id: u1, user2_id: u2 },
                defaults: { user1_id: u1, user2_id: u2 }
            });

            await Message.update(
                { read: true },
                { where: { conversation_id: conversation.id, sender_id: otherId, read: false } }
            );

            const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));

            const latestMessages = await Message.findAll({
                where: { conversation_id: conversation.id },
                include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'avatar'] }],
                order: [['created_at', 'DESC'], ['id', 'DESC']],
                limit
            });
            const messages = latestMessages.reverse();

            res.json({
                id: conversation.id,
                otherUser: { id: other.id, username: other.username, avatar: other.avatar || null },
                messages: messages.map(m => ({
                    id: m.id,
                    conversationId: conversation.id,
                    senderId: m.sender_id,
                    senderName: m.sender?.username || '',
                    avatar: m.sender?.avatar || null,
                    content: m.content,
                    read: m.read,
                    createdAt: m.created_at
                }))
            });
        } catch (err) { next(err); }
    },

    async createMessage(req, res, next) {
        try {
            const { conversation_id, content } = req.body;
            const sender_id = Number(req.user.id);

            if (!content || !String(content).trim()) {
                return res.status(400).json({ message: 'Vui lòng nhập nội dung tin nhắn' });
            }

            const conv = await Conversation.findByPk(conversation_id);
            if (!conv) {
                return res.status(404).json({ message: 'Hội thoại không tồn tại' });
            }
            if (Number(conv.user1_id) !== sender_id && Number(conv.user2_id) !== sender_id) {
                return res.status(403).json({ message: 'Không có quyền truy cập hội thoại này' });
            }

            const message = await Message.create({
                conversation_id,
                sender_id,
                content: String(content).trim()
            });
            await conv.update({ updatedAt: new Date() });

            res.status(201).json({
                message: 'Gửi tin nhắn thành công',
                id: message.id,
                createdAt: message.created_at
            });
        } catch (err) { next(err); }
    }
};

module.exports = ChatController;
