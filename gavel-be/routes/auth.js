const router = require('express').Router();
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, [
    body('username').isLength({ min: 3 }).withMessage('Tên đăng nhập phải có ít nhất 3 ký tự'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    validate
], AuthController.register);

router.post('/login', authLimiter, [
    body('username').notEmpty().withMessage('Vui lòng nhập tên đăng nhập'),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu'),
    validate
], AuthController.login);

// Rate limit riêng: refresh bị gọi lại nhiều (mỗi khi access token hết hạn)
// nhưng vẫn phải chặn lạm dụng.
router.post('/refresh', refreshLimiter, AuthController.refresh);

router.post('/logout', AuthController.logout);

router.get('/me', auth, AuthController.me);

module.exports = router;
