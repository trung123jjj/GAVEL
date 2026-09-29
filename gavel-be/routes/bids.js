const router = require('express').Router();
const { body } = require('express-validator');
const BidController = require('../controllers/BidController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { bidLimiter } = require('../middleware/rateLimit');

router.get('/auction/:auctionId', BidController.findByAuction);

router.post('/', auth, bidLimiter, [
    body('auction_id').isInt().withMessage('Auction ID is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be > 0'),
    validate
], BidController.create);

module.exports = router;
