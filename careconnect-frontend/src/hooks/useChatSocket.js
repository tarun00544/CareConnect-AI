import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket } from '../services/socket';
import { SOCKET_EVENTS, getMessages, sendMessageRest } from '../services/chatService';

/**
 * Real-time chat for one conversation using the backend's exact Socket.IO contract (sockets/chatSocket.js).
 * Loads history over REST, joins the `conversation:<id>` room, listens for receive_message / typing /
 * read_receipt / presence:update, and re-joins the room after every reconnect.
 */
export function useChatSocket({ conversationId, myUserId, otherUserId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(null); // null = unknown
  const [otherReadAt, setOtherReadAt] = useState(null);
  const typingTimer = useRef(null);
  const typingSent = useRef(false);

  const markRead = useCallback(() => {
    if (!conversationId) return;
    const s = connectSocket();
    if (s.connected) s.emit(SOCKET_EVENTS.MARK_READ, { conversationId });
  }, [conversationId]);

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      setMessages(await getMessages(conversationId));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setOtherTyping(false);
    setOtherReadAt(null);
    if (!conversationId) return undefined;
    loadHistory();

    const socket = connectSocket();

    const join = () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, { conversationId }, (ack) => {
        if (ack?.error) setError(new Error(ack.error));
        else markRead();
      });
      if (otherUserId) {
        socket.emit(SOCKET_EVENTS.PRESENCE_CHECK, { userId: String(otherUserId) }, (ack) => {
          if (ack && typeof ack.online === 'boolean') setOtherOnline(ack.online);
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onReceive = (msg) => {
      if (String(msg.conversationId) !== String(conversationId)) return;
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      if (String(msg.senderId) !== String(myUserId)) {
        setOtherTyping(false);
        markRead();
      }
    };
    const onTyping = ({ userId, isTyping }) => {
      if (String(userId) !== String(myUserId)) setOtherTyping(!!isTyping);
    };
    const onReadReceipt = ({ conversationId: cid, readBy }) => {
      if (String(cid) === String(conversationId) && String(readBy) !== String(myUserId)) {
        setOtherReadAt(Date.now());
        setMessages((prev) => prev.map((m) => (String(m.senderId) === String(myUserId) ? { ...m, read: true } : m)));
      }
    };
    const onPresence = ({ userId, online }) => {
      if (otherUserId && String(userId) === String(otherUserId)) setOtherOnline(!!online);
    };

    socket.on('connect', join); // fires on first connect AND every reconnect → rejoin room
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, onReceive);
    socket.on(SOCKET_EVENTS.TYPING_IN, onTyping);
    socket.on(SOCKET_EVENTS.READ_RECEIPT, onReadReceipt);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    if (socket.connected) join();

    return () => {
      clearTimeout(typingTimer.current);
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE, onReceive);
      socket.off(SOCKET_EVENTS.TYPING_IN, onTyping);
      socket.off(SOCKET_EVENTS.READ_RECEIPT, onReadReceipt);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    };
  }, [conversationId, myUserId, otherUserId, loadHistory, markRead]);

  const send = useCallback(
    async (text, attachment) => {
      const message = String(text || '').trim();
      if (!conversationId || (!message && !attachment)) return { ok: false };
      const socket = connectSocket();

      // Prefer the socket (primary path); fall back to the REST endpoint when the socket is down.
      if (socket.connected) {
        return new Promise((resolve) => {
          socket.timeout(8000).emit(SOCKET_EVENTS.SEND_MESSAGE, { conversationId, message, attachment }, (err, ack) => {
            if (err) return resolve({ ok: false, error: new Error('Message timed out — please try again.') });
            if (ack?.error) return resolve({ ok: false, error: new Error(ack.error) });
            // The server also broadcasts receive_message to the room (which includes us); dedupe by _id.
            if (ack?.message) setMessages((prev) => (prev.some((m) => m._id === ack.message._id) ? prev : [...prev, ack.message]));
            return resolve({ ok: true });
          });
        });
      }
      try {
        const saved = await sendMessageRest(conversationId, { message, attachment });
        setMessages((prev) => (prev.some((m) => m._id === saved._id) ? prev : [...prev, saved]));
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [conversationId]
  );

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const socket = connectSocket();
    if (!socket.connected) return;
    if (!typingSent.current) {
      socket.emit(SOCKET_EVENTS.TYPING, { conversationId, isTyping: true });
      typingSent.current = true;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.TYPING, { conversationId, isTyping: false });
      typingSent.current = false;
    }, 1500);
  }, [conversationId]);

  return { messages, loading, error, connected, otherTyping, otherOnline, otherReadAt, send, notifyTyping, reload: loadHistory };
}
