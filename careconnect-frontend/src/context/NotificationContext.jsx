import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import { connectSocket, disconnectSocket } from '../services/socket';
import { SOCKET_EVENTS } from '../services/chatService';
import { STORAGE_KEYS } from '../constants';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from '../services/notificationService';

const NotificationContext = createContext(null);
const MAX = 50;

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useApp();
  const [items, setItems] = useState(loadSession);
  const [socketStatus, setSocketStatus] = useState('disconnected'); // connecting | connected | disconnected | error
  const [unreadMessages, setUnreadMessages] = useState({}); // conversationId → count (from notification:new_message)
  const [loading, setLoading] = useState(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(items.slice(0, MAX)));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((n) => {
    setItems((prev) => {
      const id = n.id || n._id || `${n.type}-${Date.now()}`;
      // Prevent duplicates if already present
      const exists = prev.some((item) => (item.id || item._id) === id);
      if (exists) {
        return prev.map((item) => ((item.id || item._id) === id ? { ...item, ...n, id } : item));
      }
      return [{ read: false, receivedAt: new Date().toISOString(), ...n, id }, ...prev].slice(0, MAX);
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await getNotifications({ limit: MAX });
      if (res?.items) {
        const normalized = res.items.map((n) => ({
          id: n._id,
          _id: n._id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: !!n.read,
          metadata: n.metadata || {},
          createdAt: n.createdAt,
        }));
        setItems((prev) => {
          // Merge persistent history with any in-memory items received before REST returned
          const ids = new Set(normalized.map((x) => x.id));
          const uniqueSessionItems = prev.filter((x) => !ids.has(x.id));
          return [...uniqueSessionItems, ...normalized].slice(0, MAX);
        });
      }
    } catch (err) {
      console.warn('Failed to fetch persistent notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setSocketStatus('disconnected');
      setItems([]);
      setUnreadMessages({});
      try {
        sessionStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      } catch {
        /* ignore */
      }
      return undefined;
    }

    // Load persistent history from backend
    fetchHistory();

    setSocketStatus('connecting');
    const socket = connectSocket();

    const onConnect = () => {
      setSocketStatus('connected');
      fetchHistory(); // sync any missed while offline
    };
    const onDisconnect = () => setSocketStatus('disconnected');
    const onError = () => setSocketStatus('error');

    const onNotification = (n) => {
      add({
        id: n.id || n._id || `${n.type}-${Date.now()}`,
        _id: n.id || n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        createdAt: n.createdAt,
      });
      toastRef.current.info(n.message, { title: n.title });
    };

    const onRoleNotification = (n) => {
      add({
        id: n.id || n._id || `${n.type}-${Date.now()}`,
        _id: n.id || n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        createdAt: n.createdAt,
      });
      toastRef.current.info(n.message, { title: n.title });
    };

    const onNewMessage = ({ conversationId, preview }) => {
      setUnreadMessages((m) => ({ ...m, [conversationId]: (m[conversationId] || 0) + 1 }));
      add({
        id: `msg-${conversationId}-${Date.now()}`,
        type: 'NEW_MESSAGE',
        title: 'New message',
        message: preview || 'You have a new message',
        metadata: { conversationId },
      });
    };

    const onEmergency = (c) => {
      add({
        id: `em-${c._id}`,
        type: 'EMERGENCY_NEW',
        title: 'New emergency case',
        message: `${c.emergencyType || 'Emergency'} — status ${c.status}`,
        metadata: { emergencyId: c._id },
      });
      toastRef.current.warning(`${c.emergencyType || 'Emergency'} case received`, {
        title: 'New emergency case',
        duration: 9000,
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on(SOCKET_EVENTS.NOTIFICATION, onNotification);
    socket.on('notification:role', onRoleNotification);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE_NOTIFICATION, onNewMessage);
    socket.on(SOCKET_EVENTS.EMERGENCY_NEW, onEmergency);

    if (socket.connected) setSocketStatus('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off(SOCKET_EVENTS.NOTIFICATION, onNotification);
      socket.off('notification:role', onRoleNotification);
      socket.off(SOCKET_EVENTS.NEW_MESSAGE_NOTIFICATION, onNewMessage);
      socket.off(SOCKET_EVENTS.EMERGENCY_NEW, onEmergency);
    };
  }, [isAuthenticated, user?.id, add, fetchHistory]);

  const markAllRead = useCallback(async () => {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.warn('markAllNotificationsRead error:', err);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    setItems((p) => p.map((n) => (n.id === id || n._id === id ? { ...n, read: true } : n)));
    // If it's a mongo ObjectId (24 hex chars), call backend
    if (/^[a-f0-9]{24}$/i.test(String(id))) {
      try {
        await markNotificationRead(id);
      } catch (err) {
        console.warn('markNotificationRead error:', err);
      }
    }
  }, []);

  const clearAll = useCallback(async () => {
    setItems([]);
    try {
      await clearAllNotifications();
    } catch (err) {
      console.warn('clearAllNotifications error:', err);
    }
  }, []);

  const clearConversationUnread = useCallback(
    (conversationId) =>
      setUnreadMessages((m) => {
        if (!m[conversationId]) return m;
        const { [conversationId]: _drop, ...rest } = m;
        return rest;
      }),
    []
  );

  const value = useMemo(
    () => ({
      notifications: items,
      unreadCount: items.filter((n) => !n.read).length,
      socketStatus,
      unreadMessages,
      totalUnreadMessages: Object.values(unreadMessages).reduce((a, b) => a + b, 0),
      loading,
      fetchHistory,
      markAllRead,
      markRead,
      clearAll,
      clearConversationUnread,
    }),
    [
      items,
      socketStatus,
      unreadMessages,
      loading,
      fetchHistory,
      markAllRead,
      markRead,
      clearAll,
      clearConversationUnread,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
