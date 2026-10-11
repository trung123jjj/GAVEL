const router = require('express').Router();
const AdminController = require('../controllers/AdminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

router.use(auth, admin);
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', AdminController.setUserStatus);

module.exports = router;
