const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const { getOwnPatientRecord } = require('./patientController');
const { getOwnDoctorRecord } = require('./doctorController');
const { ROLES } = require('../config/constants');

async function assertConversationAccess(conversation, user) {
  if (user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(user._id);
    if (String(conversation.patientId) !== String(patient._id)) throw ApiError.forbidden('Access denied');
  } else if (user.role === ROLES.DOCTOR) {
    const doctor = await getOwnDoctorRecord(user._id);
    if (String(conversation.doctorId) !== String(doctor._id)) throw ApiError.forbidden('Access denied');
  } else if (![ROLES.SUPER_ADMIN].includes(user.role)) {
    throw ApiError.forbidden('Access denied');
  }
}

const createConversation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  let conversation = await Conversation.findOne({ appointmentId: appointment._id });
  if (!conversation) {
    conversation = await Conversation.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
    });
  }
  new ApiResponse(201, conversation).send(res);
});

const listConversations = asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    filter.patientId = patient._id;
  } else if (req.user.role === ROLES.DOCTOR) {
    const doctor = await getOwnDoctorRecord(req.user._id);
    filter.doctorId = doctor._id;
  }
  const conversations = await Conversation.find(filter).sort({ updatedAt: -1 }).populate('patientId doctorId');
  new ApiResponse(200, conversations).send(res);
});

const getMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  await assertConversationAccess(conversation, req.user);

  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  new ApiResponse(200, messages).send(res);
});

// REST fallback for sending a message (the primary path is Socket.IO —
// see sockets/chatSocket.js — but this covers clients/environments where a
// websocket connection isn't available).
const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  await assertConversationAccess(conversation, req.user);

  const Patient = require('../models/Patient');
  const Doctor = require('../models/Doctor');
  const patient = await Patient.findById(conversation.patientId);
  const doctor = await Doctor.findById(conversation.doctorId);
  const receiverId = String(req.user._id) === String(patient.userId) ? doctor.userId : patient.userId;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    receiverId,
    message: req.body.message,
    attachment: req.body.attachment,
  });

  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversation._id}`).emit('receive_message', message);

  new ApiResponse(201, message).send(res);
});

module.exports = { createConversation, listConversations, getMessages, sendMessage, assertConversationAccess };
