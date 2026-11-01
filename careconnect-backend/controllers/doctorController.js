const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');
const { escapeRegex } = require('../utils/regex');
const scheduleService = require('../services/scheduleService');
const { ROLES } = require('../config/constants');

// Public directory output: NO email/phone, registration details, documents or verification notes.
// (Those fields are also `select:false` on the schema, this is defence in depth.)
const PUBLIC_POPULATE_USER = 'name';

async function getOwnDoctorRecord(userId) {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) throw ApiError.notFound('Doctor profile not found');
  return doctor;
}

const listDoctors = asyncHandler(async (req, res) => {
  const { departmentId, hospitalId, specialization } = req.query;
  // Only active, bookable (and, per policy, verified) professionals appear in the directory.
  const filter = scheduleService.bookableFilter();
  if (departmentId) filter.departmentId = departmentId;
  if (hospitalId) filter.hospitalId = hospitalId;
  if (specialization) {
    const rx = new RegExp(escapeRegex(String(specialization).slice(0, 80)), 'i');
    filter.$or = [{ specialization: rx }, { additionalSpecializations: rx }];
  }

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Doctor.find(filter).populate('userId', PUBLIC_POPULATE_USER).populate('departmentId hospitalId').skip(skip).limit(limit),
    Doctor.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

// A doctor's own profile (including fields hidden from the public directory).
const getMe = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id })
    .select('+registration.number +registration.council +registration.state +dateOfBirth +address')
    .populate('userId', 'name email phone status emailVerified lastLoginAt')
    .populate('departmentId hospitalId');
  if (!doctor) throw ApiError.notFound('Doctor profile not found');
  new ApiResponse(200, doctor).send(res);
});

const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate('userId', PUBLIC_POPULATE_USER).populate('departmentId hospitalId');
  if (!doctor) throw ApiError.notFound('Doctor not found');

  // Non-bookable doctors (inactive / unverified / booking off) are visible only to the doctor
  // themselves and to administrators of that hospital — not to the public or other patients.
  if (scheduleService.bookingBlockReason(doctor)) {
    const u = req.user;
    const isSelf = u && String(doctor.userId?._id || doctor.userId) === String(u._id);
    const isAdmin = u && (u.role === ROLES.SUPER_ADMIN || (u.role === ROLES.HOSPITAL_ADMIN && String(u.hospitalId) === String(doctor.hospitalId?._id || doctor.hospitalId)));
    if (!isSelf && !isAdmin) throw ApiError.notFound('Doctor not found');
  }
  new ApiResponse(200, doctor).send(res);
});

// Computes actual open slots for a given date: weekly template minus breaks, leave dates,
// the daily cap and already-booked appointments. Non-bookable doctors return no slots.
const getAvailability = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw ApiError.badRequest('date query param is required (YYYY-MM-DD)');

  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  new ApiResponse(200, await scheduleService.slotsForDate(doctor, date)).send(res);
});

const updateMyAvailability = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  if (req.body.availability !== undefined) {
    const problems = scheduleService.validateAvailability(req.body.availability);
    if (problems.length) throw ApiError.badRequest('Validation failed', problems.map((message) => ({ field: 'availability', message })));
    doctor.availability = scheduleService.cleanAvailability(req.body.availability, doctor.appointmentDurationMinutes || 20);
  }
  await doctor.save();
  new ApiResponse(200, doctor, 'Availability updated').send(res);
});

const getMyAppointments = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Appointment.find({ doctorId: doctor._id }).sort({ date: -1 }).skip(skip).limit(limit).populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } }),
    Appointment.countDocuments({ doctorId: doctor._id }),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

// Returns only patients with whom this doctor has an active care
// relationship (i.e. an existing appointment) — a doctor cannot browse the
// full patient list.
const getMyPatients = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  const patientIds = await Appointment.distinct('patientId', { doctorId: doctor._id });
  const Patient = require('../models/Patient');
  const patients = await Patient.find({ _id: { $in: patientIds } }).populate('userId', 'name email phone');
  new ApiResponse(200, patients).send(res);
});

module.exports = {
  listDoctors,
  getMe,
  getDoctor,
  getAvailability,
  updateMyAvailability,
  getMyAppointments,
  getMyPatients,
  getOwnDoctorRecord,
};
