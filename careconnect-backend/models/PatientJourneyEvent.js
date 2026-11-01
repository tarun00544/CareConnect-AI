const mongoose = require('mongoose');

const patientJourneyEventSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    category: {
      type: String,
      enum: [
        'REGISTRATION',
        'APPOINTMENT',
        'CONSULTATION',
        'REPORT_UPLOAD',
        'REPORT_COMPARISON',
        'PRESCRIPTION',
        'ADMISSION',
        'DISCHARGE',
        'DOCTOR_NOTE',
        'FOLLOW_UP_CREATED',
        'FOLLOW_UP_COMPLETED',
        'REFERRAL',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    eventDate: { type: Date, default: Date.now, index: true },
    relatedModel: { type: String, default: null },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

patientJourneyEventSchema.index({ patientId: 1, eventDate: -1 });

module.exports = mongoose.model('PatientJourneyEvent', patientJourneyEventSchema);
