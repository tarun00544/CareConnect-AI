const mongoose = require('mongoose');
const { FOLLOW_UP_STATUS } = require('../config/constants');

const followUpSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true, default: '' },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(FOLLOW_UP_STATUS),
      default: FOLLOW_UP_STATUS.UPCOMING,
      index: true,
    },
    requestedReportType: { type: String, default: '' },
    requestedReportDescription: { type: String, default: '' },
    uploadedReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', default: null },
    completionNotes: { type: String, trim: true, default: '' },
    completedAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

followUpSchema.index({ patientId: 1, dueDate: 1 });
followUpSchema.index({ doctorId: 1, dueDate: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
