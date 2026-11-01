const crypto = require('crypto');
const VideoSession = require('../models/VideoSession');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function getIceServers() {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:global.stun.twilio.com:3478'] },
  ];

  const turnUrls = (env.webrtc?.turnUrls && env.webrtc.turnUrls.length > 0)
    ? env.webrtc.turnUrls
    : (process.env.TURN_URLS ? process.env.TURN_URLS.split(',').map((s) => s.trim()).filter(Boolean) : []);
  const turnUsername = env.webrtc?.turnUsername || process.env.TURN_USERNAME;
  const turnCredential = env.webrtc?.turnCredential || process.env.TURN_CREDENTIAL;

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

async function createSession(appointmentId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (appointment.consultationType !== 'VIDEO') {
    throw ApiError.badRequest('This appointment is not configured for video consultation');
  }

  const eligibleStatuses = ['CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED', 'PENDING'];
  if (!eligibleStatuses.includes(appointment.status)) {
    throw ApiError.badRequest(`Appointment status "${appointment.status}" is not eligible for video consultation`);
  }

  let session = await VideoSession.findOne({ appointmentId });
  if (!session) {
    const roomName = `careconnect-${appointmentId}-${crypto.randomBytes(4).toString('hex')}`;
    session = await VideoSession.create({ appointmentId, roomName, status: 'CREATED' });
  } else if (session.status === 'ENDED') {
    // Reopen session for repeat or reconnecting consultation
    session.status = 'CREATED';
    session.startedAt = null;
    session.endedAt = null;
    await session.save();
  }
  return session;
}

async function getSession(sessionId, userId) {
  const session = await VideoSession.findById(sessionId);
  if (!session) throw ApiError.notFound('Video session not found');

  const clientToken = mintClientToken(session.roomName, userId);
  const iceServers = getIceServers();
  return { session, clientToken, iceServers };
}

function mintClientToken(roomName, userId) {
  const secret = env.video.apiSecret || env.jwt.secret || 'careconnect-webrtc-signaling-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${roomName}:${userId}:${Date.now()}`)
    .digest('hex');
}

async function endSession(appointmentId) {
  const session = await VideoSession.findOne({ appointmentId });
  if (!session) return null;

  session.status = 'ENDED';
  session.endedAt = new Date();
  if (session.startedAt) {
    session.durationSeconds = Math.max(0, Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000));
  }
  await session.save();
  return session;
}

async function activateSession(appointmentId) {
  const session = await VideoSession.findOne({ appointmentId });
  if (!session) return null;

  if (session.status !== 'ACTIVE') {
    session.status = 'ACTIVE';
    if (!session.startedAt) session.startedAt = new Date();
    await session.save();
  }
  return session;
}

module.exports = {
  createSession,
  getSession,
  getIceServers,
  endSession,
  activateSession,
};
