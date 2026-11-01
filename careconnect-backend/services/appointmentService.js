const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const ApiError = require('../utils/ApiError');
const { APPOINTMENT_STATUS } = require('../config/constants');
const notificationService = require('./notificationService');
const scheduleService = require('./scheduleService');
const { runInTransaction } = require('../utils/transaction');

// Double-booking prevention strategy (defense in depth):
// 1. Application-level pre-check inside a Mongo session/transaction.
// 2. A unique partial index on (doctorId, date, startTime) for active
//    statuses at the database level (see models/Appointment.js) — this is
//    what actually guarantees correctness under concurrent requests, since
//    the pre-check alone is subject to a race between check and insert.
async function createAppointment({ patientId, doctorId, hospitalId, departmentId, date, startTime, endTime, consultationType, notes }) { // eslint-disable-line no-param-reassign
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw ApiError.badRequest('Doctor is not available for booking');
  // Backend enforcement (never trust the client): active + verified + booking enabled, the slot is
  // on the doctor's real schedule (not a break / leave day / past), daily cap not exceeded, and the
  // end time is derived server-side.
  const slot = await scheduleService.assertSlotBookable(doctor, { date, startTime });
  const type = consultationType || 'VIDEO';
  if (!(doctor.consultationModes || []).includes(type)) {
    throw ApiError.badRequest('This doctor does not offer the selected consultation type');
  }
  if (type !== 'IN_PERSON' && doctor.onlineConsultationAvailable === false) {
    throw ApiError.badRequest('This doctor is not offering online consultations');
  }
  date = slot.date;
  endTime = slot.endTime;

  const ACTIVE = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.RESCHEDULED];
  let createdAppointment = null;
  try {
    // Uses a transaction where the deployment supports one (replica set / Atlas); on a standalone
    // mongod it runs without, and the unique partial index below remains the real guarantee.
    createdAppointment = await runInTransaction(async (session) => {
      const opts = session ? { session } : {};
      const existing = await Appointment.findOne({ doctorId, date: new Date(date), startTime, status: { $in: ACTIVE } }).session(session || null);
      if (existing) throw ApiError.conflict('This time slot is already booked for the selected doctor');
      const created = await Appointment.create(
        [{ patientId, doctorId, hospitalId, departmentId, date: new Date(date), startTime, endTime, consultationType: type, notes }],
        opts
      );
      return created[0];
    });
  } catch (err) {
    // Unique index violation surfaces as a duplicate-key error (11000) if the race window was hit.
    if (err.code === 11000) throw ApiError.conflict('This time slot is already booked for the selected doctor');
    throw err;
  }

  // Real-time and persistent appointment notification triggers
  try {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(patientId).populate('userId', 'name');
    if (patient?.userId?._id) {
      await notificationService.appointmentRequested(patient.userId._id, createdAppointment);
    }
    if (doctor.userId) {
      const patientName = patient?.userId?.name || 'A patient';
      await notificationService.newAppointmentRequestDoctor(doctor.userId, createdAppointment, patientName);
    }
  } catch (notifErr) {
    console.warn('Failed to dispatch appointment creation notifications:', notifErr);
  }

  return createdAppointment;
}

async function updateStatus(appointmentId, newStatus, actingUser) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  appointment.status = newStatus;
  await appointment.save();

  const Patient = require('../models/Patient');
  const patient = await Patient.findById(appointment.patientId);
  const doctor = await Doctor.findById(appointment.doctorId);

  if (newStatus === APPOINTMENT_STATUS.CONFIRMED) {
    if (patient?.userId) await notificationService.doctorAccepted(patient.userId, appointment);
  } else if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
    if (patient?.userId) await notificationService.appointmentCancelled(patient.userId, appointment, actingUser?.role);
    if (doctor?.userId) await notificationService.appointmentCancelled(doctor.userId, appointment, actingUser?.role);
  }

  return appointment;
}

async function reschedule(appointmentId, { date, startTime, endTime }, actingUser) { // eslint-disable-line no-param-reassign
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  const doctor = await Doctor.findById(appointment.doctorId);
  if (!doctor) throw ApiError.badRequest('Doctor is not available for booking');
  const slot = await scheduleService.assertSlotBookable(doctor, { date, startTime }, { ignoreAppointmentId: appointmentId });
  date = slot.date; // eslint-disable-line no-param-reassign
  endTime = slot.endTime; // eslint-disable-line no-param-reassign

  const conflict = await Appointment.findOne({
    _id: { $ne: appointmentId },
    doctorId: appointment.doctorId,
    date: new Date(date),
    startTime,
    status: { $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.RESCHEDULED] },
  });
  if (conflict) throw ApiError.conflict('This time slot is already booked for the selected doctor');

  appointment.date = new Date(date);
  appointment.startTime = startTime;
  appointment.endTime = endTime;
  appointment.status = APPOINTMENT_STATUS.RESCHEDULED;
  await appointment.save();

  try {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(appointment.patientId);
    if (patient?.userId) await notificationService.appointmentRescheduled(patient.userId, appointment, actingUser?.role);
    if (doctor?.userId) await notificationService.appointmentRescheduled(doctor.userId, appointment, actingUser?.role);
  } catch (notifErr) {
    console.warn('Failed to dispatch reschedule notifications:', notifErr);
  }

  return appointment;
}

module.exports = { createAppointment, updateStatus, reschedule };
