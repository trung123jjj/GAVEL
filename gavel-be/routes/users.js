const router = require('express').Router();
const UserController = require('../controllers/UserController');
const auth = require('../middleware/auth');

router.put('/avatar', auth, UserController.updateAvatar);
router.get('/notifications', auth, UserController.getNotifications);
router.post('/notifications/read', auth, UserController.markNotificationsRead);
router.get('/:id', UserController.getProfile);

module.exports = router;
