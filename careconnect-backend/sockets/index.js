const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/generateTokens');
const User = require('../models/User');
const { registerChatHandlers } = require('./chatSocket');
const { registerVideoHandlers } = require('./videoSocket');
const env = require('../config/env');
const logger = require('../utils/logger');

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  // Socket authentication middleware: every connection must present a valid
  // JWT access token (same one used for REST auth) before any event
  // handler runs. Unauthenticated sockets are rejected at the handshake.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication token missing'));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('-passwordHash');
      if (!user || user.status !== 'ACTIVE') return next(new Error('Account not found or inactive'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    const role = socket.user.role;
    logger.info('Socket connected', { userId, role });

    // Join personal notification room strictly derived from authenticated token
    socket.join(`user:${userId}`);

    // Join role-specific broadcast room (e.g. role:PHARMACY_ADMIN, role:DOCTOR)
    if (role) {
      socket.join(`role:${role}`);
    }

    // Hospital admins/staff can join a hospital-wide room to receive
    // emergency dispatch events (see emergencyController).
    if (socket.user.hospitalId) {
      socket.join(`hospital:${socket.user.hospitalId}`);
    }

    registerChatHandlers(io, socket);
    registerVideoHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { userId, role, reason });
    });
  });

  return io;
}

module.exports = initSockets;
