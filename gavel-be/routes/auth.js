const router = require('express').Router();
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const { authLimiter, refreshLimiter, recoveryLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, [
    body('username').isLength({ min: 3 }).withMessage('Tên đăng nhập phải có ít nhất 3 ký tự'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('email').isEmail().withMessage('Email không hợp lệ').isLength({ max: 254 }).withMessage('Email quá dài'),
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

router.post('/password/forgot', recoveryLimiter, [
    body('email').isEmail().withMessage('Email không hợp lệ').isLength({ max: 254 }).withMessage('Email quá dài'),
    validate
], AuthController.requestPasswordReset);

router.post('/password/reset', recoveryLimiter, [
    body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Liên kết đặt lại mật khẩu không hợp lệ'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    validate
], AuthController.resetPassword);

router.post('/email/verify', recoveryLimiter, [
    body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Liên kết xác minh email không hợp lệ'),
    validate
], AuthController.verifyRecoveryEmail);

router.post('/email/verification/resend', recoveryLimiter, [
    body('email').isEmail().withMessage('Email không hợp lệ').isLength({ max: 254 }).withMessage('Email quá dài'),
    validate
], AuthController.resendEmailVerification);

router.post('/recovery-email', auth, recoveryLimiter, [
    body('email').isEmail().withMessage('Email không hợp lệ').isLength({ max: 254 }).withMessage('Email quá dài'),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu hiện tại'),
    validate
], AuthController.requestRecoveryEmail);

router.post('/logout', AuthController.logout);

router.get('/me', auth, AuthController.me);

module.exports = router;
