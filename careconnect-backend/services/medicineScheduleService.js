const mongoose = require('mongoose');
const MedicineSchedule = require('../models/MedicineSchedule');
const MedicineLog = require('../models/MedicineLog');
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const ApiError = require('../utils/ApiError');
const { REMINDER_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const notificationService = require('./notificationService');
const userPreferenceService = require('./userPreferenceService');
const deviceTokenService = require('./deviceTokenService');

/**
 * Format Date to YYYY-MM-DD in a specific timezone
 */
function getLocalDateString(date = new Date(), timezone = 'Asia/Kolkata') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Create a medicine schedule from an authorized prescription
 */
async function createSchedule({
  patientId,
  doctorId,
  prescriptionId,
  medicineName,
  dosage,
  prescribedInstructions,
  startDate,
  endDate,
  reminderTimes,
  timezone = 'Asia/Kolkata',
  refillReminder = {},
}) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) {
    throw ApiError.notFound('Prescription not found');
  }

  // Authorization check: doctor must be the prescriber and prescription must match patient
  if (String(prescription.doctorId) !== String(doctorId)) {
    throw ApiError.forbidden('You are not authorized to create schedules for this prescription');
  }
  if (String(prescription.patientId) !== String(patientId)) {
    throw ApiError.badRequest('Prescription patient does not match schedule patient');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw ApiError.badRequest('Valid start and end dates are required');
  }
  if (start > end) {
    throw ApiError.badRequest('Start date cannot be after end date');
  }

  // Calculate default refill reminder date if enabled
  const remindDaysBefore = Number(refillReminder?.remindDaysBefore) || 3;
  let reminderDate = refillReminder?.reminderDate ? new Date(refillReminder.reminderDate) : null;
  if (refillReminder?.enabled && !reminderDate) {
    reminderDate = new Date(end.getTime() - remindDaysBefore * 24 * 60 * 60 * 1000);
  }

  const schedule = await MedicineSchedule.create({
    patientId,
    doctorId,
    prescriptionId,
    medicineName,
    dosage,
    prescribedInstructions,
    startDate: start,
    endDate: end,
    reminderTimes,
    timezone,
    refillReminder: {
      enabled: !!refillReminder?.enabled,
      remindDaysBefore,
      reminderDate,
      dismissed: false,
    },
  });

  // Seed today's logs if active today
  const todayStr = getLocalDateString(new Date(), timezone);
  const startStr = getLocalDateString(start, timezone);
  const endStr = getLocalDateString(end, timezone);

  if (startStr <= todayStr && todayStr <= endStr) {
    for (const time of reminderTimes) {
      const occurrenceId = `${schedule._id}_${todayStr}_${time}`;
      await MedicineLog.findOneAndUpdate(
        { occurrenceId },
        {
          $setOnInsert: {
            scheduleId: schedule._id,
            patientId,
            occurrenceId,
            scheduledDate: todayStr,
            scheduledTime: time,
            medicineName,
            dosage,
            instructions: prescribedInstructions,
            status: REMINDER_STATUS.PENDING,
          },
        },
        { upsert: true }
      );
    }
  }

  return schedule;
}

/**
 * Get active or all schedules for a patient
 */
async function getPatientSchedules(patientId, { activeOnly = false } = {}) {
  const filter = { patientId };
  if (activeOnly) filter.active = true;

  return MedicineSchedule.find(filter)
    .sort({ createdAt: -1 })
    .populate('prescriptionId', 'medicines instructions notes createdAt')
    .populate({
      path: 'doctorId',
      select: 'userId departmentId',
      populate: { path: 'userId', select: 'name email phone' },
    });
}

/**
 * Get schedules for a doctor-patient relationship
 */
async function getDoctorPatientSchedules(doctorId, patientId) {
  return MedicineSchedule.find({ doctorId, patientId })
    .sort({ createdAt: -1 })
    .populate('prescriptionId');
}

/**
 * Update an existing schedule (doctor only)
 */
async function updateSchedule(scheduleId, doctorId, updates) {
  const schedule = await MedicineSchedule.findById(scheduleId);
  if (!schedule) throw ApiError.notFound('Medicine schedule not found');
  if (String(schedule.doctorId) !== String(doctorId)) {
    throw ApiError.forbidden('You are not authorized to modify this schedule');
  }

  const allowedFields = ['reminderTimes', 'prescribedInstructions', 'active', 'refillReminder', 'endDate'];
  for (const f of allowedFields) {
    if (updates[f] !== undefined) schedule[f] = updates[f];
  }

  await schedule.save();
  return schedule;
}

/**
 * Get today's reminders with deduplicated occurrence logs
 */
async function getTodayReminders(patientId, dateStr = null, timezone = 'Asia/Kolkata') {
  const targetDate = dateStr || getLocalDateString(new Date(), timezone);

  // Find all active schedules covering targetDate
  const targetMidnight = new Date(`${targetDate}T00:00:00Z`);
  const schedules = await MedicineSchedule.find({
    patientId,
    active: true,
    startDate: { $lte: new Date(`${targetDate}T23:59:59Z`) },
    endDate: { $gte: targetMidnight },
  });

  // Ensure an occurrence log exists for each schedule reminder time today
  for (const schedule of schedules) {
    for (const time of schedule.reminderTimes) {
      const occurrenceId = `${schedule._id}_${targetDate}_${time}`;
      await MedicineLog.findOneAndUpdate(
        { occurrenceId },
        {
          $setOnInsert: {
            scheduleId: schedule._id,
            patientId,
            occurrenceId,
            scheduledDate: targetDate,
            scheduledTime: time,
            medicineName: schedule.medicineName,
            dosage: schedule.dosage,
            instructions: schedule.prescribedInstructions,
            status: REMINDER_STATUS.PENDING,
          },
        },
        { upsert: true }
      );
    }
  }

  // Retrieve today's logs
  const logs = await MedicineLog.find({ patientId, scheduledDate: targetDate })
    .sort({ scheduledTime: 1 })
    .populate('scheduleId', 'prescriptionId active refillReminder');

  return {
    date: targetDate,
    reminders: logs,
  };
}

/**
 * Confirm medicine taken - Patient Action Only.
 * NEVER automatically marks as taken.
 */
async function confirmTaken(logId, patientId) {
  const log = await MedicineLog.findOne({ _id: logId, patientId });
  if (!log) throw ApiError.notFound('Reminder log not found');

  log.status = REMINDER_STATUS.TAKEN;
  log.takenAt = new Date();
  await log.save();

  return log;
}

/**
 * Snooze reminder - Patient Action
 */
async function snoozeReminder(logId, patientId, snoozeMinutes = 15) {
  const log = await MedicineLog.findOne({ _id: logId, patientId });
  if (!log) throw ApiError.notFound('Reminder log not found');

  const mins = Math.max(5, Math.min(120, Number(snoozeMinutes) || 15));
  log.status = REMINDER_STATUS.SNOOZED;
  log.snoozedUntil = new Date(Date.now() + mins * 60 * 1000);
  log.snoozeCount = (log.snoozeCount || 0) + 1;
  await log.save();

  return log;
}

/**
 * Skip reminder - Patient Action with optional reason
 */
async function skipReminder(logId, patientId, reason = '') {
  const log = await MedicineLog.findOne({ _id: logId, patientId });
  if (!log) throw ApiError.notFound('Reminder log not found');

  log.status = REMINDER_STATUS.SKIPPED;
  log.skippedReason = reason || 'Skipped by patient';
  await log.save();

  return log;
}

/**
 * Configure refill reminder - Patient Action
 * Does not assume a refill date is a new prescription or authorize automatic purchases.
 */
async function configureRefillReminder(scheduleId, patientId, { enabled, remindDaysBefore = 3 }) {
  const schedule = await MedicineSchedule.findOne({ _id: scheduleId, patientId });
  if (!schedule) throw ApiError.notFound('Medicine schedule not found');

  schedule.refillReminder.enabled = !!enabled;
  schedule.refillReminder.remindDaysBefore = Number(remindDaysBefore) || 3;
  schedule.refillReminder.reminderDate = new Date(
    schedule.endDate.getTime() - schedule.refillReminder.remindDaysBefore * 24 * 60 * 60 * 1000
  );
  schedule.refillReminder.dismissed = false;

  await schedule.save();
  return schedule;
}

/**
 * Get Adherence Statistics
 * Rule: Unconfirmed reminders are labeled "Unconfirmed", NEVER "Missed".
 */
async function getAdherenceStats(patientId, days = 7) {
  const numDays = Math.max(1, Math.min(90, Number(days) || 7));
  const sinceDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000);
  const sinceStr = sinceDate.toISOString().split('T')[0];

  const logs = await MedicineLog.find({
    patientId,
    scheduledDate: { $gte: sinceStr },
  }).sort({ scheduledDate: -1, scheduledTime: 1 });

  const total = logs.length;
  const taken = logs.filter((l) => l.status === REMINDER_STATUS.TAKEN).length;
  const skipped = logs.filter((l) => l.status === REMINDER_STATUS.SKIPPED).length;
  const snoozed = logs.filter((l) => l.status === REMINDER_STATUS.SNOOZED).length;
  const unconfirmed = logs.filter((l) => l.status === REMINDER_STATUS.PENDING).length;

  const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 100;

  // Group by date for weekly chart
  const dailyMap = {};
  logs.forEach((l) => {
    if (!dailyMap[l.scheduledDate]) {
      dailyMap[l.scheduledDate] = { date: l.scheduledDate, total: 0, taken: 0, skipped: 0, unconfirmed: 0 };
    }
    dailyMap[l.scheduledDate].total += 1;
    if (l.status === REMINDER_STATUS.TAKEN) dailyMap[l.scheduledDate].taken += 1;
    else if (l.status === REMINDER_STATUS.SKIPPED) dailyMap[l.scheduledDate].skipped += 1;
    else dailyMap[l.scheduledDate].unconfirmed += 1;
  });

  return {
    days: numDays,
    summary: {
      totalScheduled: total,
      confirmedTaken: taken,
      skipped,
      snoozed,
      unconfirmed, // Strictly named unconfirmed, not missed
      adherenceRate,
    },
    dailyHistory: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    recentLogs: logs.slice(0, 20),
  };
}

/**
 * Dispatch due medicine reminders and prevent duplicate notifications via unique occurrenceId
 */
async function dispatchDueReminders() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHours = String(now.getUTCHours()).padStart(2, '0');
  const currentMins = String(now.getUTCMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMins}`;

  // Find pending logs for today where notification hasn't been emitted
  const dueLogs = await MedicineLog.find({
    scheduledDate: todayStr,
    status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.SNOOZED] },
  }).populate('scheduleId patientId');

  const dispatched = [];

  for (const log of dueLogs) {
    if (!log.patientId?.userId) continue;

    const patientUser = log.patientId.userId;
    const pref = await userPreferenceService.getPreferences(patientUser);

    // Check quiet hours
    if (userPreferenceService.isQuietHours(pref, now)) {
      continue;
    }

    // Check if notification with this occurrenceId was already created (Duplicate Prevention)
    const existing = await notificationService.findNotificationByOccurrenceId(log.occurrenceId);
    if (existing) continue;

    // Dispatch notification
    const notif = await notificationService.medicineReminder(patientUser, log, pref);
    dispatched.push(notif);
  }

  return dispatched;
}

module.exports = {
  createSchedule,
  getPatientSchedules,
  getDoctorPatientSchedules,
  updateSchedule,
  getTodayReminders,
  confirmTaken,
  snoozeReminder,
  skipReminder,
  configureRefillReminder,
  getAdherenceStats,
  dispatchDueReminders,
  getLocalDateString,
};
