const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Presence tracking: userId -> Set of connected socket ids. Lets us answer
// "is this user online" across multiple tabs/devices.
const onlineUsers = new Map();

function markOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function markOffline(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function isOnline(userId) {
  return onlineUsers.has(String(userId));
}

async function assertParticipant(conversation, userId) {
  const patient = await Patient.findById(conversation.patientId);
  const doctor = await Doctor.findById(conversation.doctorId);
  const allowed = [String(patient?.userId), String(doctor?.userId)];
  return allowed.includes(String(userId));
}

function registerChatHandlers(io, socket) {
  const userId = String(socket.user._id);

  // connection + authentication happened in the io.use() middleware in
  // sockets/index.js before this handler ever runs.
  socket.join(`user:${userId}`);
  markOnline(userId, socket.id);
  socket.broadcast.emit('presence:update', { userId, online: true });

  // join conversation
  socket.on('join_conversation', async ({ conversationId }, ack) => {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return ack?.({ error: 'Conversation not found' });
      const allowed = await assertParticipant(conversation, userId);
      if (!allowed) return ack?.({ error: 'Not authorized for this conversation' });

      socket.join(`conversation:${conversationId}`);
      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to join conversation' });
    }
  });

  // send message
  socket.on('send_message', async ({ conversationId, message, attachment }, ack) => {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return ack?.({ error: 'Conversation not found' });
      const allowed = await assertParticipant(conversation, userId);
      if (!allowed) return ack?.({ error: 'Not authorized for this conversation' });

      const patient = await Patient.findById(conversation.patientId);
      const doctor = await Doctor.findById(conversation.doctorId);
      const receiverId = userId === String(patient.userId) ? doctor.userId : patient.userId;

      const saved = await Message.create({
        conversationId,
        senderId: userId,
        receiverId,
        message,
        attachment,
      });

      io.to(`conversation:${conversationId}`).emit('receive_message', saved);
      io.to(`user:${receiverId}`).emit('notification:new_message', { conversationId, preview: message?.slice(0, 80) });
      ack?.({ success: true, message: saved });
    } catch (err) {
      ack?.({ error: 'Failed to send message' });
    }
  });

  // typing indicator
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('typing', { userId, isTyping: !!isTyping });
  });

  // read receipt
  socket.on('mark_read', async ({ conversationId }) => {
    await Message.updateMany({ conversationId, receiverId: userId, read: false }, { read: true });
    socket.to(`conversation:${conversationId}`).emit('read_receipt', { conversationId, readBy: userId });
  });

  // online/offline status query
  socket.on('presence:check', ({ userId: targetId }, ack) => {
    ack?.({ userId: targetId, online: isOnline(targetId) });
  });

  socket.on('disconnect', () => {
    markOffline(userId, socket.id);
    if (!isOnline(userId)) {
      socket.broadcast.emit('presence:update', { userId, online: false });
    }
  });
}

module.exports = { registerChatHandlers, isOnline };
