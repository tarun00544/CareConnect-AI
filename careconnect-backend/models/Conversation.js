const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

conversationSchema.index({ patientId: 1 });
conversationSchema.index({ doctorId: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
