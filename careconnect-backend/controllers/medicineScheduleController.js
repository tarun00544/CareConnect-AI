const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const medicineScheduleService = require('../services/medicineScheduleService');
const { getOwnPatientRecord } = require('./patientController');
const { getOwnDoctorRecord } = require('./doctorController');
const Patient = require('../models/Patient');

// POST /api/schedules (DOCTOR)
const createSchedule = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);

  const schedule = await medicineScheduleService.createSchedule({
    patientId: req.body.patientId,
    doctorId: doctor._id,
    prescriptionId: req.body.prescriptionId,
    medicineName: req.body.medicineName,
    dosage: req.body.dosage,
    prescribedInstructions: req.body.prescribedInstructions,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    reminderTimes: req.body.reminderTimes,
    timezone: req.body.timezone,
    refillReminder: req.body.refillReminder,
  });

  new ApiResponse(201, schedule, 'Medicine schedule created').send(res);
});

// GET /api/schedules/my (PATIENT)
const getMySchedules = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const activeOnly = req.query.active === 'true';
  const schedules = await medicineScheduleService.getPatientSchedules(patient._id, { activeOnly });
  new ApiResponse(200, schedules).send(res);
});

// GET /api/schedules/patient/:patientId (DOCTOR)
const getDoctorPatientSchedules = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  const schedules = await medicineScheduleService.getDoctorPatientSchedules(doctor._id, req.params.patientId);
  new ApiResponse(200, schedules).send(res);
});

// PATCH /api/schedules/:id (DOCTOR)
const updateSchedule = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctorRecord(req.user._id);
  const schedule = await medicineScheduleService.updateSchedule(req.params.id, doctor._id, req.body);
  new ApiResponse(200, schedule, 'Medicine schedule updated').send(res);
});

// GET /api/schedules/reminders/today (PATIENT)
const getTodayReminders = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const data = await medicineScheduleService.getTodayReminders(patient._id, req.query.date, req.query.timezone);
  new ApiResponse(200, data).send(res);
});

// PATCH /api/schedules/reminders/:logId/taken (PATIENT)
const confirmTaken = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const log = await medicineScheduleService.confirmTaken(req.params.logId, patient._id);
  new ApiResponse(200, log, 'Medicine confirmed as taken').send(res);
});

// PATCH /api/schedules/reminders/:logId/snooze (PATIENT)
const snoozeReminder = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const log = await medicineScheduleService.snoozeReminder(req.params.logId, patient._id, req.body.snoozeMinutes);
  new ApiResponse(200, log, 'Reminder snoozed').send(res);
});

// PATCH /api/schedules/reminders/:logId/skip (PATIENT)
const skipReminder = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const log = await medicineScheduleService.skipReminder(req.params.logId, patient._id, req.body.reason);
  new ApiResponse(200, log, 'Reminder skipped').send(res);
});

// PATCH /api/schedules/:scheduleId/refill (PATIENT)
const configureRefillReminder = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const schedule = await medicineScheduleService.configureRefillReminder(req.params.scheduleId, patient._id, req.body);
  new ApiResponse(200, schedule, 'Refill reminder updated').send(res);
});

// GET /api/schedules/adherence (PATIENT)
const getAdherenceStats = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const stats = await medicineScheduleService.getAdherenceStats(patient._id, req.query.days);
  new ApiResponse(200, stats).send(res);
});

// GET /api/schedules/adherence/patient/:patientId (DOCTOR)
const getDoctorPatientAdherence = asyncHandler(async (req, res) => {
  await getOwnDoctorRecord(req.user._id);
  const stats = await medicineScheduleService.getAdherenceStats(req.params.patientId, req.query.days);
  new ApiResponse(200, stats).send(res);
});

module.exports = {
  createSchedule,
  getMySchedules,
  getDoctorPatientSchedules,
  updateSchedule,
  getTodayReminders,
  confirmTaken,
  snoozeReminder,
  skipReminder,
  configureRefillReminder,
  getAdherenceStats,
  getDoctorPatientAdherence,
};
