const { request, app, resetDb, registerUser, auth } = require('./helpers');
const { Notification } = require('../models');

describe('User notifications', () => {
    let user;
    let otherUser;

    beforeAll(async () => {
        await resetDb();
        user = await registerUser('notifications_user');
        otherUser = await registerUser('notifications_other');
    });

    test('allows an authenticated user to delete their own notification and updates unread count', async () => {
        const notification = await Notification.create({
            user_id: user.user.id,
            type: 'system',
            title: 'Thông báo cần xóa',
            message: 'Nội dung thông báo'
        });

        const deleted = await request(app)
            .delete(`/api/users/notifications/${notification.id}`)
            .set(auth(user.token));
        expect(deleted.status).toBe(204);
        expect(await Notification.findByPk(notification.id)).toBeNull();

        const remaining = await Notification.create({
            user_id: user.user.id,
            type: 'system',
            title: 'Thông báo còn lại',
            message: 'Chưa đọc'
        });
        const notifications = await request(app)
            .get('/api/users/notifications')
            .set(auth(user.token));
        expect(notifications.status).toBe(200);
        expect(notifications.body.notifications.map((item) => item.id)).toContain(remaining.id);
        expect(notifications.body.unreadCount).toBe(1);
    });

    test('does not allow deleting another user notification or unauthenticated deletion', async () => {
        const notification = await Notification.create({
            user_id: otherUser.user.id,
            type: 'system',
            title: 'Thông báo riêng',
            message: 'Chỉ chủ tài khoản được xóa'
        });

        const unauthenticated = await request(app)
            .delete(`/api/users/notifications/${notification.id}`);
        expect(unauthenticated.status).toBe(401);

        const forbidden = await request(app)
            .delete(`/api/users/notifications/${notification.id}`)
            .set(auth(user.token));
        expect(forbidden.status).toBe(404);
        expect(await Notification.findByPk(notification.id)).not.toBeNull();
    });

    test('validates notification IDs and reports missing notifications', async () => {
        const invalid = await request(app)
            .delete('/api/users/notifications/not-an-id')
            .set(auth(user.token));
        expect(invalid.status).toBe(400);

        const missing = await request(app)
            .delete('/api/users/notifications/999999')
            .set(auth(user.token));
        expect(missing.status).toBe(404);
    });
});
