const mongoose = require('mongoose');
const { PATIENT_SUMMARY_STATUS } = require('../config/constants');

const patientSummarySchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    aiGenerated: {
      patientOverview: { type: String, default: '' },
      previousConsultationSummary: { type: String, default: '' },
      currentConcerns: { type: String, default: '' },
      relevantMedicalHistory: { type: String, default: '' },
      recentReportComparisonSummary: { type: String, default: '' },
      pendingFollowUpTasks: { type: String, default: '' },
      suggestedDoctorQuestions: [{ type: String }],
      generatedAt: { type: Date, default: Date.now },
    },
    doctorDraft: {
      patientOverview: { type: String, default: '' },
      previousConsultationSummary: { type: String, default: '' },
      currentConcerns: { type: String, default: '' },
      relevantMedicalHistory: { type: String, default: '' },
      recentReportComparisonSummary: { type: String, default: '' },
      pendingFollowUpTasks: { type: String, default: '' },
      clinicalObservations: { type: String, default: '' },
      suggestedQuestions: [{ type: String }],
    },
    status: {
      type: String,
      enum: Object.values(PATIENT_SUMMARY_STATUS),
      default: PATIENT_SUMMARY_STATUS.AI_GENERATED,
    },
    isApproved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    sharedWithPatient: { type: Boolean, default: false },
    sharedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

patientSummarySchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('PatientSummary', patientSummarySchema);
