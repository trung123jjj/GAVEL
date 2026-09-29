const router = require('express').Router();
const { body } = require('express-validator');
const ReviewController = require('../controllers/ReviewController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/user/:userId', ReviewController.getByUser);

router.post('/user/:userId', auth, [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
], ReviewController.create);

module.exports = router;
