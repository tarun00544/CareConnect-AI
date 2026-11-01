const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');

router.use(authenticate);

router.post('/', chatController.createConversation);
router.get('/', chatController.listConversations);
router.get('/:id/messages', mongoIdParam(), validate, chatController.getMessages);
router.post('/:id/messages', mongoIdParam(), validate, chatController.sendMessage);

module.exports = router;
