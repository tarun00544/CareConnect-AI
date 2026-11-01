const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Notification = require('../models/Notification');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/notifications
// Retrieves notifications for the authenticated user only (ownership guaranteed).
const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { userId: req.user._id };

  if (req.query.unreadOnly === 'true') {
    filter.read = false;
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);

  const paginated = buildPaginatedResult(items, total, page, limit);
  paginated.unreadCount = unreadCount;

  new ApiResponse(200, paginated).send(res);
});

// PATCH /api/notifications/:id/read
// Mark a single notification as read, ensuring it belongs to the authenticated user.
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  new ApiResponse(200, notification, 'Notification marked as read').send(res);
});

// PATCH /api/notifications/read-all
// Mark all notifications for the authenticated user as read.
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, read: false },
    { read: true }
  );

  new ApiResponse(200, { modifiedCount: result.modifiedCount }, 'All notifications marked as read').send(res);
});

// DELETE /api/notifications/:id
// Delete a specific notification owned by the authenticated user.
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  new ApiResponse(200, null, 'Notification deleted').send(res);
});

// DELETE /api/notifications
// Clear all notifications for the authenticated user.
const clearAll = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ userId: req.user._id });
  new ApiResponse(200, { deletedCount: result.deletedCount }, 'All notifications cleared').send(res);
});

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  clearAll,
};
