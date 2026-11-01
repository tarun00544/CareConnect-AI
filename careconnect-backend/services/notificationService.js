const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// Central place to create notifications. `io` (Socket.IO server instance)
// is injected lazily via setIo() from server.js so this module has no
// circular dependency on sockets/index.js, and can still push realtime
// events when a client is connected.
let ioInstance = null;
function setIo(io) {
  ioInstance = io;
}

async function notify(userId, type, title, message, metadata = {}) {
  const notification = await Notification.create({ userId, type, title, message, metadata });

  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification', {
      id: notification._id,
      type,
      title,
      message,
      metadata,
      createdAt: notification.createdAt,
    });
  } else {
    logger.info('Notification created (no active socket)', { userId: String(userId), type });
  }

  return notification;
}

async function notifyRole(role, type, title, message, metadata = {}) {
  const User = require('../models/User');
  const users = await User.find({ role, status: 'ACTIVE' }).select('_id');
  const notifications = await Promise.all(
    users.map((u) => notify(u._id, type, title, message, metadata))
  );

  if (ioInstance) {
    ioInstance.to(`role:${role}`).emit('notification:role', {
      type,
      title,
      message,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  return notifications;
}

async function findNotificationByOccurrenceId(occurrenceId) {
  if (!occurrenceId) return null;
  return Notification.findOne({ 'metadata.occurrenceId': occurrenceId });
}

module.exports = {
  setIo,
  notify,
  notifyRole,
  findNotificationByOccurrenceId,
  // Convenience helpers matching each event required by the spec.
  medicineReminder: async (userId, log, pref = null) => {
    const maskLockScreen = pref?.privacy?.maskLockScreenDetails ?? true;
    const occurrenceId = log.occurrenceId;
    const title = maskLockScreen ? 'Medication Reminder' : `Take ${log.medicineName} (${log.dosage || 'Prescribed dose'})`;
    const message = maskLockScreen
      ? 'Time for your scheduled medication'
      : `${log.medicineName}: ${log.instructions || 'Take as prescribed'}. Scheduled at ${log.scheduledTime}.`;

    return notify(userId, 'MEDICINE_REMINDER', title, message, {
      occurrenceId,
      logId: log._id,
      scheduleId: log.scheduleId?._id || log.scheduleId,
      medicineName: log.medicineName,
      dosage: log.dosage,
      instructions: log.instructions,
      scheduledTime: log.scheduledTime,
      channelId: 'channel_medicine_reminders',
      isPrivate: maskLockScreen,
    });
  },
  refillReminder: (userId, schedule) =>
    notify(userId, 'REFILL_REMINDER', 'Prescription Refill Reminder', `Your prescription for ${schedule.medicineName} ends on ${new Date(schedule.endDate).toLocaleDateString()}. Consider arranging a refill or consultation.`, { scheduleId: schedule._id, medicineName: schedule.medicineName, channelId: 'channel_refills' }),
  labTestReminder: (userId, title, description, metadata = {}) =>
    notify(userId, 'LAB_TEST_REMINDER', title || 'Lab Test Reminder', description || 'You have an upcoming medical test or requested report pending.', { ...metadata, channelId: 'channel_appointments' }),
  appointmentRequested: (patientUserId, appt) =>
    notify(patientUserId, 'APPOINTMENT_REQUESTED', 'Appointment Requested', `Your appointment request for ${new Date(appt.date).toLocaleDateString()} at ${appt.startTime} has been received.`, { appointmentId: appt._id }),
  newAppointmentRequestDoctor: (doctorUserId, appt, patientName = 'A patient') =>
    notify(doctorUserId, 'NEW_APPOINTMENT_REQUEST', 'New Appointment Request', `${patientName} has requested an appointment for ${new Date(appt.date).toLocaleDateString()} at ${appt.startTime}.`, { appointmentId: appt._id }),
  appointmentCancelled: (userId, appt, roleContext = '') =>
    notify(userId, 'APPOINTMENT_CANCELLED', 'Appointment Cancelled', `The appointment scheduled for ${new Date(appt.date).toLocaleDateString()} at ${appt.startTime} has been cancelled${roleContext ? ` by ${roleContext}` : ''}.`, { appointmentId: appt._id }),
  appointmentRescheduled: (userId, appt, roleContext = '') =>
    notify(userId, 'APPOINTMENT_RESCHEDULED', 'Appointment Rescheduled', `The appointment has been rescheduled to ${new Date(appt.date).toLocaleDateString()} at ${appt.startTime}${roleContext ? ` by ${roleContext}` : ''}.`, { appointmentId: appt._id }),
  newMedicineOrderPharmacy: (order, patientName = 'A patient') =>
    notifyRole('PHARMACY_ADMIN', 'NEW_MEDICINE_ORDER', 'New Medicine Order', `${patientName} placed an order for ₹${order.total || order.subtotal}.`, { orderId: order._id }),
  lowStockAlert: (medicine) =>
    notifyRole('PHARMACY_ADMIN', 'LOW_STOCK_ALERT', 'Low Stock Alert', `${medicine.name} stock has dropped to ${medicine.stock} units.`, { medicineId: medicine._id, stock: medicine.stock }),
  systemAlert: (userId, title, message, metadata = {}) =>
    notify(userId, 'SYSTEM_ALERT', title, message, metadata),
  appointmentConfirmed: (userId, appt) =>
    notify(userId, 'APPOINTMENT_CONFIRMED', 'Appointment Confirmed', `Your appointment on ${appt.date.toDateString()} at ${appt.startTime} is confirmed.`, { appointmentId: appt._id }),
  appointmentReminder: (userId, appt) =>
    notify(userId, 'APPOINTMENT_REMINDER', 'Upcoming Appointment', `Reminder: you have an appointment at ${appt.startTime} today.`, { appointmentId: appt._id }),
  doctorAccepted: (userId, appt) =>
    notify(userId, 'DOCTOR_ACCEPTED', 'Doctor Accepted Appointment', 'The doctor has accepted your appointment request.', { appointmentId: appt._id }),
  prescriptionUploaded: (userId, prescriptionId) =>
    notify(userId, 'PRESCRIPTION_UPLOADED', 'New Prescription', 'A new prescription has been added to your records.', { prescriptionId }),
  admissionApproved: (userId, admissionId) =>
    notify(userId, 'ADMISSION_APPROVED', 'Admission Approved', 'Your hospital admission request has been approved.', { admissionId }),
  bedAllocated: (userId, bedId) =>
    notify(userId, 'BED_ALLOCATED', 'Bed Allocated', 'A bed has been allocated for your admission.', { bedId }),
  medicineOrder: (userId, orderId, status) =>
    notify(userId, 'MEDICINE_ORDER', 'Order Update', `Your medicine order status is now ${status}.`, { orderId }),
  paymentConfirmed: (userId, paymentId) =>
    notify(userId, 'PAYMENT_CONFIRMED', 'Payment Successful', 'Your payment has been received and verified.', { paymentId }),
  deliveryUpdate: (userId, orderId, deliveryStatus) =>
    notify(userId, 'DELIVERY_UPDATE', 'Delivery Update', `Delivery status: ${deliveryStatus}.`, { orderId }),
  emergencyUpdate: (userId, emergencyId, status) =>
    notify(userId, 'EMERGENCY_UPDATE', 'Emergency Case Update', `Your emergency case status is now ${status}.`, { emergencyId }),
  followUpCreated: (userId, followUp) =>
    notify(userId, 'FOLLOW_UP_CREATED', 'New Follow-Up Scheduled', `A follow-up titled "${followUp.title}" has been set for ${new Date(followUp.dueDate).toLocaleDateString()}.`, { followUpId: followUp._id }),
  followUpReminder: (userId, followUp) =>
    notify(userId, 'FOLLOW_UP_REMINDER', 'Follow-Up Due Soon', `Reminder: Your follow-up "${followUp.title}" is due on ${new Date(followUp.dueDate).toLocaleDateString()}.`, { followUpId: followUp._id }),
  followUpCompleted: (userId, followUp) =>
    notify(userId, 'FOLLOW_UP_COMPLETED', 'Follow-Up Completed', `Your follow-up "${followUp.title}" has been marked completed by your doctor.`, { followUpId: followUp._id }),
  reportRequested: (userId, followUp) =>
    notify(userId, 'REPORT_REQUESTED', 'Medical Report Requested', `Your doctor has requested a report: ${followUp.requestedReportDescription || followUp.requestedReportType}.`, { followUpId: followUp._id }),
  reportUploaded: (userId, recordId) =>
    notify(userId, 'REPORT_UPLOADED', 'Report Uploaded', 'Your medical report has been uploaded and linked to your records.', { recordId }),
  referralReceived: (userId, referral) =>
    notify(userId, 'REFERRAL_RECEIVED', 'New Doctor Referral', 'A doctor collaboration referral has been assigned to you.', { referralId: referral._id }),
  referralUpdated: (userId, referral) =>
    notify(userId, 'REFERRAL_UPDATED', 'Referral Status Update', `Your referral status is now ${referral.status}.`, { referralId: referral._id }),
  referralConsentRequest: (userId, referral) =>
    notify(userId, 'REFERRAL_CONSENT_REQUEST', 'Referral Consent Requested', 'A doctor has requested your consent to share medical records for a specialist referral.', { referralId: referral._id }),
  summaryShared: (userId, summary) =>
    notify(userId, 'SUMMARY_SHARED', 'Doctor-Approved Summary Available', 'Your doctor has approved and shared your healthcare journey summary.', { summaryId: summary._id }),
  reportComparisonApproved: (userId, comparison) =>
    notify(userId, 'REPORT_COMPARISON_APPROVED', 'Report Comparison Reviewed', 'Your doctor has reviewed and approved clinical observations for your report comparison.', { comparisonId: comparison._id }),
};
