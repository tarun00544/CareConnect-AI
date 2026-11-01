const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const appointmentService = require('../services/appointmentService');
const notificationService = require('../services/notificationService');
const { getOwnPatientRecord } = require('./patientController');
const { getOwnDoctorRecord } = require('./doctorController');
const { ROLES } = require('../config/constants');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');

const createAppointment = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const doctor = await Doctor.findById(req.body.doctorId);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const appointment = await appointmentService.createAppointment({
    patientId: patient._id,
    doctorId: doctor._id,
    hospitalId: doctor.hospitalId,
    departmentId: doctor.departmentId,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    consultationType: req.body.consultationType,
    notes: req.body.notes,
  });

  new ApiResponse(201, appointment, 'Appointment requested').send(res);
});

// Ownership check helper: a patient can only see their own appointments, a
// doctor only appointments assigned to them; admins/super-admins may view
// more broadly.
// The appointment may arrive with these refs populated (documents) or not (ObjectIds).
const refId = (v) => String((v && v._id) || v);

async function assertAppointmentAccess(appointment, user) {
  if (user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(user._id);
    if (refId(appointment.patientId) !== String(patient._id)) {
      throw ApiError.forbidden('You do not have access to this appointment');
    }
  } else if (user.role === ROLES.DOCTOR) {
    const doctor = await getOwnDoctorRecord(user._id);
    if (refId(appointment.doctorId) !== String(doctor._id)) {
      throw ApiError.forbidden('You do not have access to this appointment');
    }
  } else if (user.role === ROLES.HOSPITAL_ADMIN) {
    if (refId(appointment.hospitalId) !== String(user.hospitalId)) {
      throw ApiError.forbidden('You do not have access to this appointment');
    }
  }
  // SUPER_ADMIN: unrestricted
}

const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate({
      path: 'doctorId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        { path: 'departmentId', select: 'name' },
      ],
    })
    .populate('hospitalId departmentId patientId');
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);
  new ApiResponse(200, appointment).send(res);
});

const getMyAppointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  let filter = {};
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    filter.patientId = patient._id;
  } else if (req.user.role === ROLES.DOCTOR) {
    const doctor = await getOwnDoctorRecord(req.user._id);
    filter.doctorId = doctor._id;
  } else {
    throw ApiError.forbidden('Only patients and doctors have a personal appointment list');
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'doctorId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          { path: 'departmentId', select: 'name' },
        ],
      })
      .populate('hospitalId departmentId patientId'),
    Appointment.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const updateStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  const updated = await appointmentService.updateStatus(req.params.id, req.body.status, req.user);
  new ApiResponse(200, updated, 'Appointment status updated').send(res);
});

const reschedule = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  const updated = await appointmentService.reschedule(req.params.id, req.body, req.user);
  new ApiResponse(200, updated, 'Appointment rescheduled').send(res);
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  await assertAppointmentAccess(appointment, req.user);

  appointment.status = 'CANCELLED';
  await appointment.save();

  try {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(appointment.patientId);
    const doctor = await Doctor.findById(appointment.doctorId);

    if (patient?.userId) {
      await notificationService.appointmentCancelled(patient.userId, appointment, req.user.role);
    }
    if (doctor?.userId) {
      await notificationService.appointmentCancelled(doctor.userId, appointment, req.user.role);
    }
  } catch (notifErr) {
    console.warn('Failed to dispatch appointment cancellation notifications:', notifErr);
  }

  new ApiResponse(200, appointment, 'Appointment cancelled').send(res);
});

module.exports = { createAppointment, getAppointment, getMyAppointments, updateStatus, reschedule, cancelAppointment, assertAppointmentAccess };
