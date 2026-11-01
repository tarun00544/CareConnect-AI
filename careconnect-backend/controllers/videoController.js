const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Appointment = require('../models/Appointment');
const videoService = require('../services/videoService');
const { assertAppointmentAccess } = require('./appointmentController');

const createSession = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  const session = await videoService.createSession(appointment._id);
  new ApiResponse(201, {
    id: session._id,
    roomName: session.roomName,
    status: session.status,
    appointmentId: session.appointmentId,
  }, 'Video session created').send(res);
});

const getSession = asyncHandler(async (req, res) => {
  const { session, clientToken, iceServers } = await videoService.getSession(req.params.id, req.user._id);
  const appointment = await Appointment.findById(session.appointmentId)
    .populate({
      path: 'doctorId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'patientId',
      populate: { path: 'userId', select: 'name email phone' },
    });

  if (appointment) await assertAppointmentAccess(appointment, req.user);

  new ApiResponse(200, {
    id: session._id,
    roomName: session.roomName,
    status: session.status,
    appointmentId: session.appointmentId,
    clientToken,
    iceServers,
    appointment,
  }).send(res);
});

const getIceServers = asyncHandler(async (req, res) => {
  const iceServers = videoService.getIceServers();
  new ApiResponse(200, { iceServers }).send(res);
});

const endSession = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  const session = await videoService.endSession(appointment._id);
  new ApiResponse(200, session, 'Video session ended').send(res);
});

module.exports = {
  createSession,
  getSession,
  getIceServers,
  endSession,
};
