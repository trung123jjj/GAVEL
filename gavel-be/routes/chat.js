const router = require('express').Router();
const { body } = require('express-validator');
const ChatController = require('../controllers/ChatController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/conversations', auth, ChatController.getConversations);
router.get('/conversation/:userId', auth, ChatController.getOrCreateConversation);

router.post('/messages', auth, [
    body('conversation_id').isInt().withMessage('conversation_id is required'),
    body('content').notEmpty().withMessage('content is required'),
    validate
], ChatController.createMessage);

module.exports = router;
