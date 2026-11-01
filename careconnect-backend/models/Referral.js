const mongoose = require('mongoose');
const { REFERRAL_STATUS } = require('../config/constants');

const referralSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    referringDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    referredDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null, index: true },
    referredDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    referredHospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
    reason: { type: String, required: true, trim: true },
    clinicalNotes: { type: String, trim: true, default: '' },
    priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], default: 'ROUTINE' },
    status: {
      type: String,
      enum: Object.values(REFERRAL_STATUS),
      default: REFERRAL_STATUS.PENDING,
      index: true,
    },
    patientConsent: {
      granted: { type: Boolean, default: false },
      consentDate: { type: Date, default: null },
      notes: { type: String, default: '' },
    },
    receivingDoctorNotes: { type: String, trim: true, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralSchema.index({ patientId: 1, createdAt: -1 });
referralSchema.index({ referredDoctorId: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
