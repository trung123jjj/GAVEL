const router = require('express').Router();
const { body } = require('express-validator');
const AuctionController = require('../controllers/AuctionController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', AuctionController.findAll);
router.get('/:id', AuctionController.findById);

router.post('/', auth, [
    body('title').notEmpty().withMessage('Vui lòng nhập tên sản phẩm'),
    body('description').notEmpty().withMessage('Vui lòng nhập mô tả'),
    body('starting_price').isFloat({ gt: 0 }).withMessage('Giá khởi điểm phải lớn hơn 0'),
    body('min_increment').isFloat({ gt: 0 }).withMessage('Bước giá phải lớn hơn 0'),
    body('start_time').notEmpty().withMessage('Vui lòng chọn thời gian bắt đầu'),
    body('end_time').notEmpty().withMessage('Vui lòng chọn thời gian kết thúc'),
    validate
], AuctionController.create);

router.put('/:id', auth, AuctionController.update);
router.delete('/:id', auth, AuctionController.delete);

module.exports = router;
