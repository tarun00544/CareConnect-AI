const mongoose = require('mongoose');
const { REPORT_COMPARISON_STATUS } = require('../config/constants');

const reportComparisonSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null, index: true },
    baselineRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', required: true },
    currentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', required: true },
    parameters: [
      {
        name: { type: String, required: true },
        baselineValue: { type: Number, required: true },
        currentValue: { type: Number, required: true },
        unit: { type: String, default: '' },
        delta: { type: Number, default: 0 },
        percentChange: { type: Number, default: 0 },
        referenceRange: { type: String, default: '' },
        minRange: { type: Number, default: null },
        maxRange: { type: Number, default: null },
        baselineFlag: { type: String, enum: ['NORMAL', 'HIGH', 'LOW', 'UNKNOWN'], default: 'UNKNOWN' },
        currentFlag: { type: String, enum: ['NORMAL', 'HIGH', 'LOW', 'UNKNOWN'], default: 'UNKNOWN' },
      },
    ],
    aiDraftAnalysis: {
      summary: { type: String, default: '' },
      significantChanges: [{ type: String }],
      unmatchedParameters: [{ type: String }],
      safetyNotice: { type: String, default: '' },
    },
    doctorObservation: {
      notes: { type: String, trim: true, default: '' },
      nextConsultationNotes: { type: String, trim: true, default: '' },
      approved: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
      approvedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: Object.values(REPORT_COMPARISON_STATUS),
      default: REPORT_COMPARISON_STATUS.AI_GENERATED,
    },
    patientConsentGranted: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reportComparisonSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('ReportComparison', reportComparisonSchema);
