const router = require('express').Router();
const { body } = require('express-validator');
const BidController = require('../controllers/BidController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { bidLimiter } = require('../middleware/rateLimit');

router.get('/auction/:auctionId', BidController.findByAuction);

router.post('/', auth, bidLimiter, [
    body('auction_id').isInt().withMessage('Auction ID is required'),
    body('amount')
        .isFloat({ gt: 0, max: 9999999999999.99 })
        .custom((value) => /^\d{1,13}(?:\.\d{1,2})?$/.test(String(value)))
        .withMessage('Amount must be positive and have at most 2 decimal places'),
    validate
], BidController.create);

module.exports = router;
