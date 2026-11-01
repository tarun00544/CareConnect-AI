const mongoose = require('mongoose');

const medicineScheduleSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true, index: true },
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },
    prescribedInstructions: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reminderTimes: {
      type: [String],
      required: true,
      validate: {
        validator: function (times) {
          if (!Array.isArray(times) || times.length === 0) return false;
          // Validate HH:mm 24h format
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          return times.every((t) => timeRegex.test(t));
        },
        message: 'Reminder times must be an array of valid HH:mm 24-hour strings.',
      },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    active: { type: Boolean, default: true, index: true },
    refillReminder: {
      enabled: { type: Boolean, default: false },
      remindDaysBefore: { type: Number, default: 3 },
      reminderDate: { type: Date },
      dismissed: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

medicineScheduleSchema.index({ patientId: 1, active: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('MedicineSchedule', medicineScheduleSchema);
