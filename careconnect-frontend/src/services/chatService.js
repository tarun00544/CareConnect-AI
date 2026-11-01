import api from './api';
import { unwrap, toList } from '../utils/response';

// POST /api/conversations body: { appointmentId } → Conversation (idempotent: returns existing one for the appointment)
export const createConversation = async (appointmentId) => unwrap(await api.post('/api/conversations', { appointmentId }));
// GET /api/conversations → Conversation[] (patientId/doctorId populated as Patient/Doctor docs — no display names)
export const listConversations = async () => toList(unwrap(await api.get('/api/conversations')));
// GET /api/conversations/:id/messages → Message[] { _id, conversationId, senderId, receiverId, message, attachment{url,type}, read, createdAt }
export const getMessages = async (conversationId) => toList(unwrap(await api.get(`/api/conversations/${conversationId}/messages`)));
// POST /api/conversations/:id/messages body: { message, attachment? } — REST fallback; server also emits `receive_message`
export const sendMessageRest = async (conversationId, { message, attachment }) =>
  unwrap(await api.post(`/api/conversations/${conversationId}/messages`, { message, attachment }));

// Socket.IO event names, copied verbatim from backend/sockets/chatSocket.js and services/notificationService.js
export const SOCKET_EVENTS = Object.freeze({
  // client → server
  JOIN_CONVERSATION: 'join_conversation', // ({ conversationId }, ack({ success } | { error }))
  SEND_MESSAGE: 'send_message', //           ({ conversationId, message, attachment }, ack({ success, message } | { error }))
  TYPING: 'typing', //                        ({ conversationId, isTyping })
  MARK_READ: 'mark_read', //                  ({ conversationId })
  PRESENCE_CHECK: 'presence:check', //        ({ userId }, ack({ userId, online }))
  // server → client
  RECEIVE_MESSAGE: 'receive_message', //      (Message)
  TYPING_IN: 'typing', //                     ({ userId, isTyping })
  READ_RECEIPT: 'read_receipt', //            ({ conversationId, readBy })
  PRESENCE_UPDATE: 'presence:update', //      ({ userId, online })
  NEW_MESSAGE_NOTIFICATION: 'notification:new_message', // ({ conversationId, preview })
  NOTIFICATION: 'notification', //            ({ id, type, title, message, metadata, createdAt })
  EMERGENCY_NEW: 'emergency:new', //          (EmergencyCase) — only for sockets whose user has hospitalId
});
