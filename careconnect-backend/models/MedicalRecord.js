const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    type: { type: String, enum: ['LAB_REPORT', 'IMAGING', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'OTHER'], required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileUrl: { type: String, default: null },
    rawText: { type: String, trim: true },
    extractedParameters: [
      {
        name: { type: String, required: true },
        value: { type: Number, required: true },
        unit: { type: String, default: '' },
        referenceRange: { type: String, default: '' },
        minRange: { type: Number, default: null },
        maxRange: { type: Number, default: null },
        flag: { type: String, enum: ['NORMAL', 'HIGH', 'LOW', 'UNKNOWN'], default: 'UNKNOWN' },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
