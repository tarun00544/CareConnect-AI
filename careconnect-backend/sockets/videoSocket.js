const Appointment = require('../models/Appointment');
const VideoSession = require('../models/VideoSession');
const videoService = require('../services/videoService');
const logger = require('../utils/logger');
const { ROLES } = require('../config/constants');

// appointmentId -> Map<socketId, { socketId, userId, role, name }>
const activeRooms = new Map();

async function assertVideoParticipant(appointmentId, user) {
  const appointment = await Appointment.findById(appointmentId)
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name email phone' } });

  if (!appointment) {
    return { error: 'Appointment not found' };
  }

  if (appointment.consultationType !== 'VIDEO') {
    return { error: 'This appointment is not scheduled as a video consultation' };
  }

  const userId = typeof user === 'object' ? (user?._id || user?.id) : user;
  const currentUserId = String(userId || '');
  const userRole = typeof user === 'object' ? user?.role : null;

  const patientUserId = String(
    appointment.patientId?.userId?._id ||
    appointment.patientId?.userId ||
    appointment.patientId?._id ||
    appointment.patientId ||
    ''
  );
  const doctorUserId = String(
    appointment.doctorId?.userId?._id ||
    appointment.doctorId?.userId ||
    appointment.doctorId?._id ||
    appointment.doctorId ||
    ''
  );

  let userRoleInAppt = null;
  let partnerUserId = null;
  let partnerName = '';

  if (currentUserId === patientUserId) {
    userRoleInAppt = ROLES.PATIENT;
    partnerUserId = doctorUserId;
    partnerName = appointment.doctorId?.userId?.name || appointment.doctorId?.name || 'Doctor';
  } else if (currentUserId === doctorUserId) {
    userRoleInAppt = ROLES.DOCTOR;
    partnerUserId = patientUserId;
    partnerName = appointment.patientId?.userId?.name || appointment.patientId?.name || 'Patient';
  } else if (userRole === ROLES.SUPER_ADMIN) {
    userRoleInAppt = ROLES.SUPER_ADMIN;
    partnerUserId = doctorUserId;
    partnerName = appointment.doctorId?.userId?.name || 'Doctor';
  } else {
    return { error: 'You are not an authorized participant in this consultation' };
  }

  // Patients must have paid for the appointment
  if (userRoleInAppt === ROLES.PATIENT && appointment.paymentStatus !== 'PAID') {
    return { error: 'Payment is required to join this video consultation' };
  }

  // Verify appointment eligibility
  const eligibleStatuses = ['CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED', 'PENDING'];
  if (!eligibleStatuses.includes(appointment.status)) {
    return { error: `Appointment status "${appointment.status}" is not eligible for video consultation` };
  }

  return {
    allowed: true,
    appointment,
    role: userRoleInAppt,
    partnerUserId,
    partnerName,
    patientName: appointment.patientId?.userId?.name || appointment.patientId?.name || 'Patient',
  };
}

function registerVideoHandlers(io, socket) {
  const userId = String(socket.user._id);

  // 1. video:join
  socket.on('video:join', async ({ appointmentId }, ack) => {
    try {
      if (!appointmentId) return ack?.({ error: 'appointmentId is required' });

      const check = await assertVideoParticipant(appointmentId, socket.user);
      if (check.error) return ack?.({ error: check.error });

      const roomKey = `video:${appointmentId}`;
      socket.join(roomKey);

      if (!activeRooms.has(appointmentId)) {
        activeRooms.set(appointmentId, new Map());
      }
      const roomParticipants = activeRooms.get(appointmentId);
      roomParticipants.set(socket.id, {
        socketId: socket.id,
        userId,
        role: check.role,
        name: socket.user.name,
      });

      const participantCount = roomParticipants.size;
      const otherParticipants = Array.from(roomParticipants.values()).filter((p) => p.socketId !== socket.id);

      logger.info('User joined video room', { appointmentId, userId, role: check.role, participantCount });

      // If patient initiated the call and doctor is not in room, notify doctor's personal room
      if (check.role === ROLES.PATIENT && otherParticipants.length === 0) {
        io.to(`user:${check.partnerUserId}`).emit('video:incoming-call', {
          appointmentId,
          patientName: check.patientName,
          patientUserId: userId,
          date: check.appointment.date,
          startTime: check.appointment.startTime,
          consultationType: check.appointment.consultationType,
        });

        socket.emit('video:waiting', {
          message: `Calling ${check.partnerName}… Waiting for them to connect.`,
          partnerName: check.partnerName,
        });
      }

      // If doctor joined or partner is already here, announce joined and ready
      if (otherParticipants.length > 0) {
        await videoService.activateSession(appointmentId);

        // Notify existing participant that partner joined
        socket.to(roomKey).emit('video:participant-joined', {
          userId,
          role: check.role,
          name: socket.user.name,
          socketId: socket.id,
        });

        // Emit video:ready to both so peer connection initiation can commence
        io.to(roomKey).emit('video:ready', {
          appointmentId,
          callerSocketId: socket.id, // the second person to join triggers offer
          participants: Array.from(roomParticipants.values()),
        });
      }

      ack?.({
        success: true,
        role: check.role,
        appointmentId,
        participants: Array.from(roomParticipants.values()),
        isInitiator: otherParticipants.length > 0,
      });
    } catch (err) {
      logger.error('Error in video:join', { error: err.message, appointmentId });
      ack?.({ error: 'Failed to join video room' });
    }
  });

  // 2. video:offer
  socket.on('video:offer', async ({ appointmentId, offer }, ack) => {
    try {
      const roomKey = `video:${appointmentId}`;
      if (!socket.rooms.has(roomKey)) {
        return ack?.({ error: 'You are not in this video room' });
      }

      socket.to(roomKey).emit('video:offer', {
        appointmentId,
        offer,
        fromUserId: userId,
        fromSocketId: socket.id,
      });
      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to relay offer' });
    }
  });

  // 3. video:answer
  socket.on('video:answer', async ({ appointmentId, answer }, ack) => {
    try {
      const roomKey = `video:${appointmentId}`;
      if (!socket.rooms.has(roomKey)) {
        return ack?.({ error: 'You are not in this video room' });
      }

      socket.to(roomKey).emit('video:answer', {
        appointmentId,
        answer,
        fromUserId: userId,
        fromSocketId: socket.id,
      });
      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to relay answer' });
    }
  });

  // 4. video:ice-candidate
  socket.on('video:ice-candidate', async ({ appointmentId, candidate }, ack) => {
    try {
      const roomKey = `video:${appointmentId}`;
      if (!socket.rooms.has(roomKey)) {
        return ack?.({ error: 'You are not in this video room' });
      }

      socket.to(roomKey).emit('video:ice-candidate', {
        appointmentId,
        candidate,
        fromUserId: userId,
        fromSocketId: socket.id,
      });
      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to relay ICE candidate' });
    }
  });

  // 5. video:reject
  socket.on('video:reject', async ({ appointmentId, reason }, ack) => {
    try {
      const check = await assertVideoParticipant(appointmentId, socket.user);
      if (check.error) return ack?.({ error: check.error });

      const roomKey = `video:${appointmentId}`;
      io.to(roomKey).emit('video:call-rejected', {
        appointmentId,
        reason: reason || 'Doctor is currently unavailable',
        rejectedBy: socket.user.name,
      });

      // Also deliver to patient personal room in case patient hasn't joined socket room yet
      io.to(`user:${check.partnerUserId}`).emit('video:call-rejected', {
        appointmentId,
        reason: reason || 'Doctor is currently unavailable',
        rejectedBy: socket.user.name,
      });

      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to reject call' });
    }
  });

  // 6. video:leave
  socket.on('video:leave', async ({ appointmentId }, ack) => {
    const roomKey = `video:${appointmentId}`;
    socket.leave(roomKey);

    if (activeRooms.has(appointmentId)) {
      const room = activeRooms.get(appointmentId);
      room.delete(socket.id);
      if (room.size === 0) activeRooms.delete(appointmentId);
    }

    socket.to(roomKey).emit('video:participant-left', {
      appointmentId,
      userId,
      role: socket.user.role,
    });
    ack?.({ success: true });
  });

  // 7. video:ended
  socket.on('video:ended', async ({ appointmentId }, ack) => {
    try {
      const check = await assertVideoParticipant(appointmentId, socket.user);
      if (check.error) return ack?.({ error: check.error });

      await videoService.endSession(appointmentId);

      const roomKey = `video:${appointmentId}`;
      io.to(roomKey).emit('video:ended', {
        appointmentId,
        endedBy: socket.user.name,
        role: check.role,
      });

      activeRooms.delete(appointmentId);
      ack?.({ success: true });
    } catch (err) {
      ack?.({ error: 'Failed to end call' });
    }
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    for (const [appointmentId, roomParticipants] of activeRooms.entries()) {
      if (roomParticipants.has(socket.id)) {
        roomParticipants.delete(socket.id);
        const roomKey = `video:${appointmentId}`;
        socket.to(roomKey).emit('video:participant-left', {
          appointmentId,
          userId,
          role: socket.user.role,
        });
        if (roomParticipants.size === 0) {
          activeRooms.delete(appointmentId);
        }
      }
    }
  });
}

function getActiveRoomParticipants(appointmentId) {
  const room = activeRooms.get(String(appointmentId));
  if (!room) return [];
  return Array.from(room.values());
}

module.exports = {
  registerVideoHandlers,
  assertVideoParticipant,
  getActiveRoomParticipants,
  activeRooms,
};
