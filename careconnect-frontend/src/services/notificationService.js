import api from './api';
import { unwrap, toList } from '../utils/response';

// GET /api/notifications
export const getNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const params = { page, limit };
  if (unreadOnly) params.unreadOnly = 'true';
  const res = unwrap(await api.get('/api/notifications', { params }));
  return {
    items: toList(res),
    pagination: res?.pagination || { page, limit, total: 0, totalPages: 1 },
    unreadCount: res?.unreadCount ?? 0,
  };
};

// PATCH /api/notifications/:id/read
export const markNotificationRead = async (id) => {
  return unwrap(await api.patch(`/api/notifications/${id}/read`));
};

// PATCH /api/notifications/read-all
export const markAllNotificationsRead = async () => {
  return unwrap(await api.patch('/api/notifications/read-all'));
};

// DELETE /api/notifications/:id
export const deleteNotification = async (id) => {
  return unwrap(await api.delete(`/api/notifications/${id}`));
};

// DELETE /api/notifications
export const clearAllNotifications = async () => {
  return unwrap(await api.delete('/api/notifications'));
};
