const mongoose = require('mongoose');
const { REMINDER_STATUS } = require('../config/constants');

const medicineLogSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineSchedule', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    occurrenceId: { type: String, required: true, unique: true, index: true },
    scheduledDate: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    scheduledTime: { type: String, required: true }, // Format: HH:mm
    medicineName: { type: String, required: true },
    dosage: { type: String, trim: true },
    instructions: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(REMINDER_STATUS),
      default: REMINDER_STATUS.PENDING,
      index: true,
    },
    takenAt: { type: Date },
    snoozedUntil: { type: Date },
    snoozeCount: { type: Number, default: 0 },
    skippedReason: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

medicineLogSchema.index({ patientId: 1, scheduledDate: 1, status: 1 });
medicineLogSchema.index({ scheduleId: 1, scheduledDate: 1 });

module.exports = mongoose.model('MedicineLog', medicineLogSchema);
