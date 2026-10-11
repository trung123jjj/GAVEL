const router = require('express').Router();
const AdminController = require('../controllers/AdminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const AdminReportController = require('../controllers/AdminReportController');

router.use(auth, admin);
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', AdminController.setUserStatus);
router.get('/auctions', AdminController.listAuctions);
router.delete('/auctions/:id', [
    param('id').isInt({ min: 1 }).withMessage('Mã sản phẩm không hợp lệ'),
    body('reason')
        .isString()
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Vui lòng nhập lý do gỡ sản phẩm (tối đa 1000 ký tự)'),
    validate
], AdminController.removeAuction);
router.get('/reports', AdminReportController.list);
router.patch('/reports/:id/status', [
    param('id').isInt({ min: 1 }).withMessage('Mã báo cáo không hợp lệ'),
    body('status').isIn(['resolved', 'dismissed']).withMessage('Trạng thái báo cáo không hợp lệ'),
    validate
], AdminReportController.updateStatus);

module.exports = router;
