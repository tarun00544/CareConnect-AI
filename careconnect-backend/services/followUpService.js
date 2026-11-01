const FollowUp = require('../models/FollowUp');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { FOLLOW_UP_STATUS } = require('../config/constants');

async function syncOverdueFollowUps() {
  const now = new Date();
  await FollowUp.updateMany(
    {
      dueDate: { $lt: now },
      status: { $in: [FOLLOW_UP_STATUS.PENDING, FOLLOW_UP_STATUS.UPCOMING] },
    },
    { $set: { status: FOLLOW_UP_STATUS.OVERDUE } }
  );
}

async function createFollowUp({
  patientId,
  doctorId,
  appointmentId = null,
  title,
  instructions = '',
  dueDate,
  requestedReportType = '',
  requestedReportDescription = '',
}) {
  if (!patientId || !doctorId || !title || !dueDate) {
    throw ApiError.badRequest('patientId, doctorId, title, and dueDate are required');
  }

  const followUp = await FollowUp.create({
    patientId,
    doctorId,
    appointmentId,
    title: title.trim(),
    instructions: instructions.trim(),
    dueDate: new Date(dueDate),
    status: FOLLOW_UP_STATUS.UPCOMING,
    requestedReportType,
    requestedReportDescription,
  });

  // Notify patient
  try {
    const patient = await Patient.findById(patientId);
    if (patient) {
      await notificationService.followUpCreated(patient.userId, followUp);
      if (requestedReportType || requestedReportDescription) {
        await notificationService.reportRequested(patient.userId, followUp);
      }
    }
  } catch (err) {
    logger.warn('Failed to send follow-up creation notification:', err.message);
  }

  return followUp;
}

async function getPatientFollowUps(patientId) {
  await syncOverdueFollowUps();
  const followUps = await FollowUp.find({ patientId })
    .sort({ dueDate: 1 })
    .populate('doctorId', 'userId qualification specialization consultationFee')
    .populate('uploadedReportId', 'title fileUrl type createdAt');
  return followUps;
}

async function getDoctorFollowUps(doctorId, query = {}) {
  await syncOverdueFollowUps();
  const filter = { doctorId };
  if (query.status) {
    filter.status = query.status;
  }
  if (query.patientId) {
    filter.patientId = query.patientId;
  }

  const followUps = await FollowUp.find(filter)
    .sort({ dueDate: 1 })
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
    .populate('uploadedReportId', 'title fileUrl type createdAt');
  return followUps;
}

async function completeFollowUp(followUpId, doctorId, completionNotes = '') {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) throw ApiError.notFound('Follow-up task not found');

  followUp.status = FOLLOW_UP_STATUS.COMPLETED;
  followUp.completionNotes = completionNotes.trim();
  followUp.completedAt = new Date();
  await followUp.save();

  // Notify patient
  try {
    const patient = await Patient.findById(followUp.patientId);
    if (patient) {
      await notificationService.followUpCompleted(patient.userId, followUp);
    }
  } catch (err) {
    logger.warn('Failed to send follow-up completed notification:', err.message);
  }

  return followUp;
}

async function rescheduleFollowUp(followUpId, newDueDate, instructions = '') {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) throw ApiError.notFound('Follow-up task not found');

  followUp.dueDate = new Date(newDueDate);
  if (instructions) followUp.instructions = instructions;
  followUp.status = new Date(newDueDate) > new Date() ? FOLLOW_UP_STATUS.UPCOMING : FOLLOW_UP_STATUS.PENDING;
  followUp.reminderSent = false;
  await followUp.save();

  return followUp;
}

async function attachReportToFollowUp(followUpId, medicalRecordId) {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) throw ApiError.notFound('Follow-up task not found');

  followUp.uploadedReportId = medicalRecordId;
  followUp.status = FOLLOW_UP_STATUS.PENDING; // ready for doctor review
  await followUp.save();

  return followUp;
}

async function sendDueReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pendingReminders = await FollowUp.find({
    status: { $in: [FOLLOW_UP_STATUS.UPCOMING, FOLLOW_UP_STATUS.PENDING] },
    dueDate: { $lte: tomorrow },
    reminderSent: false,
  }).populate('patientId');

  let sentCount = 0;
  for (const item of pendingReminders) {
    if (item.patientId?.userId) {
      try {
        await notificationService.followUpReminder(item.patientId.userId, item);
        item.reminderSent = true;
        item.reminderSentAt = new Date();
        await item.save();
        sentCount++;
      } catch (err) {
        logger.warn('Failed to dispatch follow-up reminder:', err.message);
      }
    }
  }

  return sentCount;
}

module.exports = {
  createFollowUp,
  getPatientFollowUps,
  getDoctorFollowUps,
  completeFollowUp,
  rescheduleFollowUp,
  attachReportToFollowUp,
  sendDueReminders,
  syncOverdueFollowUps,
};
