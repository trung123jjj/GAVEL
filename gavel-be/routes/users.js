const router = require('express').Router();
const UserController = require('../controllers/UserController');
const auth = require('../middleware/auth');

router.put('/avatar', auth, UserController.updateAvatar);
router.get('/notifications', auth, UserController.getNotifications);
router.post('/notifications/read', auth, UserController.markNotificationsRead);
router.get('/watchlist', auth, UserController.getWatchlist);
router.post('/watchlist/sync', auth, UserController.syncWatchlist);
router.post('/watchlist/:auctionId', auth, UserController.addWatchlistItem);
router.delete('/watchlist/:auctionId', auth, UserController.removeWatchlistItem);
router.get('/:id', UserController.getProfile);

module.exports = router;
