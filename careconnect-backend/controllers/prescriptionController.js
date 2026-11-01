const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const prescriptionService = require('../services/prescriptionService');
const { getOwnDoctorRecord } = require('./doctorController');
const { getOwnPatientRecord } = require('./patientController');
const { ROLES } = require('../config/constants');

const createPrescription = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  const appointment = await Appointment.findById(req.body.appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (String(appointment.doctorId) !== String(doctor._id)) {
    throw ApiError.forbidden('You can only prescribe for your own appointments');
  }

  const prescription = await prescriptionService.createPrescription({
    patientId: appointment.patientId,
    doctorId: doctor._id,
    appointmentId: appointment._id,
    medicines: req.body.medicines,
    instructions: req.body.instructions,
    notes: req.body.notes,
  });

  new ApiResponse(201, prescription, 'Prescription created').send(res);
});

const getPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id).populate('doctorId patientId appointmentId');
  if (!prescription) throw ApiError.notFound('Prescription not found');

  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    if (String(prescription.patientId._id || prescription.patientId) !== String(patient._id)) {
      throw ApiError.forbidden('Access denied');
    }
  } else if (req.user.role === ROLES.DOCTOR) {
    const doctor = await getOwnDoctorRecord(req.user._id);
    if (String(prescription.doctorId._id || prescription.doctorId) !== String(doctor._id)) {
      throw ApiError.forbidden('Access denied');
    }
  }

  new ApiResponse(200, prescription).send(res);
});

module.exports = { createPrescription, getPrescription };
