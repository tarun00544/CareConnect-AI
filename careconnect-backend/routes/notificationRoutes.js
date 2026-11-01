const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');

// All notification routes require authentication.
router.use(authenticate);

// GET /api/notifications - List paginated notifications for authenticated user
router.get('/', notificationController.getNotifications);

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', notificationController.markAllRead);

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', mongoIdParam(), validate, notificationController.markRead);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', mongoIdParam(), validate, notificationController.deleteNotification);

// DELETE /api/notifications - Clear all notifications
router.delete('/', notificationController.clearAll);

module.exports = router;
