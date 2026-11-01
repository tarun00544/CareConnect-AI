const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Appointment = require('../models/Appointment');
const { assertAppointmentAccess } = require('./appointmentController');

// A "consultation" is modeled as the active/in-progress phase of an
// appointment (notes, status transitions during the visit) rather than a
// separate collection, avoiding duplicated scheduling state.
const startConsultation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  appointment.status = 'IN_PROGRESS';
  await appointment.save();
  new ApiResponse(201, appointment, 'Consultation started').send(res);
});

const getConsultation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate('doctorId patientId');
  if (!appointment) throw ApiError.notFound('Consultation not found');
  await assertAppointmentAccess(appointment, req.user);
  new ApiResponse(200, appointment).send(res);
});

const updateConsultation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Consultation not found');
  await assertAppointmentAccess(appointment, req.user);

  if (req.body.notes !== undefined) appointment.notes = req.body.notes;
  if (req.body.status) appointment.status = req.body.status;
  await appointment.save();
  new ApiResponse(200, appointment, 'Consultation updated').send(res);
});

const addNotes = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Consultation not found');
  await assertAppointmentAccess(appointment, req.user);

  appointment.notes = `${appointment.notes ? appointment.notes + '\n' : ''}${req.body.notes}`;
  await appointment.save();
  new ApiResponse(200, appointment, 'Notes added').send(res);
});

module.exports = { startConsultation, getConsultation, updateConsultation, addNotes };
