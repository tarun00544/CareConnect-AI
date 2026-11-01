const mongoose = require('mongoose');
const { APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../config/constants');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    date: { type: Date, required: true }, // calendar date (midnight UTC) of the appointment
    startTime: { type: String, required: true }, // "10:00"
    endTime: { type: String, required: true }, // "10:20"
    consultationType: { type: String, enum: ['IN_PERSON', 'VIDEO', 'AUDIO', 'CHAT'], default: 'VIDEO' },
    status: { type: String, enum: Object.values(APPOINTMENT_STATUS), default: APPOINTMENT_STATUS.PENDING },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Prevents double-booking the same doctor for the same date/startTime at the
// database level. This is the last line of defense behind the application
// -level check-then-create performed inside a session/transaction in
// appointmentService.
appointmentSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'] } },
  }
);

appointmentSchema.index({ patientId: 1, date: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
