const router = require('express').Router();
const { body, param } = require('express-validator');
const OrderController = require('../controllers/OrderController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', auth, OrderController.list);
router.patch('/:id/status', auth, [
    param('id').isInt({ min: 1 }).withMessage('Mã giao dịch không hợp lệ'),
    body('status').isIn(['paid', 'shipped', 'completed']).withMessage('Trạng thái giao dịch không hợp lệ'),
    validate
], OrderController.updateStatus);

module.exports = router;
