const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Prescription = require('../models/Prescription');
const FollowUp = require('../models/FollowUp');
const ReportComparison = require('../models/ReportComparison');
const PatientSummary = require('../models/PatientSummary');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { PATIENT_SUMMARY_STATUS } = require('../config/constants');

async function getPatientNavigationData(patientId) {
  const patient = await Patient.findById(patientId).populate('userId', 'name email phone');
  if (!patient) throw ApiError.notFound('Patient not found');

  const [
    appointments,
    prescriptions,
    medicalRecords,
    followUps,
    reportComparisons,
    latestApprovedSummary,
  ] = await Promise.all([
    Appointment.find({ patientId }).sort({ date: -1 }).populate('doctorId departmentId'),
    Prescription.find({ patientId }).sort({ createdAt: -1 }).populate('doctorId'),
    MedicalRecord.find({ patientId }).sort({ createdAt: -1 }).populate('doctorId'),
    FollowUp.find({ patientId }).sort({ dueDate: 1 }).populate('doctorId'),
    ReportComparison.find({ patientId }).sort({ createdAt: -1 }).populate('baselineRecordId currentRecordId doctorId'),
    PatientSummary.findOne({ patientId, isApproved: true }).sort({ approvedAt: -1 }).populate('doctorId'),
  ]);

  const now = new Date();
  const upcomingAppointments = appointments.filter((a) => new Date(a.date) >= now);
  const pastAppointments = appointments.filter((a) => new Date(a.date) < now);
  const pendingFollowUps = followUps.filter((f) => f.status === 'PENDING' || f.status === 'UPCOMING');

  return {
    patient,
    summaryStats: {
      totalAppointments: appointments.length,
      upcomingAppointmentsCount: upcomingAppointments.length,
      totalPrescriptions: prescriptions.length,
      totalReports: medicalRecords.length,
      pendingFollowUpsCount: pendingFollowUps.length,
      totalComparisons: reportComparisons.length,
    },
    upcomingAppointments,
    pastAppointments,
    prescriptions,
    medicalRecords,
    followUps,
    reportComparisons,
    latestApprovedSummary,
  };
}

function buildDeterministicSummary({ patient, appointments, prescriptions, medicalRecords, followUps, reportComparisons }) {
  const latestAppt = appointments[0];
  const pendingTasks = followUps.filter((f) => f.status === 'PENDING' || f.status === 'UPCOMING');
  const latestComparison = reportComparisons[0];

  const patientOverview = `${patient.userId?.name || 'Patient'} (${patient.gender || 'Gender unspecified'}, Blood Group: ${patient.bloodGroup || 'Unknown'}). ${
    patient.allergies?.length ? `Known allergies: ${patient.allergies.join(', ')}.` : 'No documented drug allergies.'
  } Current active medicines: ${patient.currentMedicines?.length ? patient.currentMedicines.join(', ') : 'None listed'}.`;

  const previousConsultationSummary = latestAppt
    ? `Last consultation was on ${new Date(latestAppt.date).toLocaleDateString()} (${latestAppt.consultationType || 'Consultation'}). Notes recorded: "${latestAppt.notes || 'Routine follow-up'}".`
    : 'No previous consultations recorded in the platform.';

  const currentConcerns = latestAppt?.notes || 'Patient presenting for continuity evaluation and follow-up care.';

  const relevantMedicalHistory = patient.medicalHistory?.length
    ? `Documented history: ${patient.medicalHistory.join('; ')}.`
    : 'No specific pre-existing conditions recorded in patient profile.';

  const recentReportComparisonSummary = latestComparison
    ? `Comparison from ${new Date(latestComparison.createdAt).toLocaleDateString()}: Evaluated ${latestComparison.parameters?.length || 0} parameter(s). Status: ${latestComparison.status}. ${latestComparison.aiDraftAnalysis?.summary || ''}`
    : `${medicalRecords.length} medical record(s) on file. No comparative report evolution completed yet.`;

  const pendingFollowUpTasks = pendingTasks.length
    ? pendingTasks.map((t) => `• ${t.title} (Due: ${new Date(t.dueDate).toLocaleDateString()})`).join('\n')
    : 'All scheduled follow-up tasks are up to date.';

  const suggestedDoctorQuestions = [
    'How have your symptoms changed since the last consultation?',
    patient.currentMedicines?.length ? 'Are you experiencing any side effects with current medications?' : 'Are you taking any over-the-counter remedies or supplements?',
    pendingTasks.length ? 'Were you able to complete the requested follow-up steps or lab tests?' : 'Do you have any new concerns or symptoms to discuss today?',
    'Have you noticed any changes in your energy level, sleep, or daily activities?',
  ];

  return {
    patientOverview,
    previousConsultationSummary,
    currentConcerns,
    relevantMedicalHistory,
    recentReportComparisonSummary,
    pendingFollowUpTasks,
    suggestedDoctorQuestions,
  };
}

async function generatePatientSummaryDraft({ patientId, doctorId, appointmentId = null }) {
  const navData = await getPatientNavigationData(patientId);
  const deterministicDraft = buildDeterministicSummary(navData);

  let aiDraft = deterministicDraft;
  try {
    const aiService = require('./aiService');
    if (aiService.runPatientNavigationSummary) {
      const generated = await aiService.runPatientNavigationSummary({
        patient: navData.patient,
        appointments: navData.pastAppointments.slice(0, 3),
        prescriptions: navData.prescriptions.slice(0, 3),
        records: navData.medicalRecords.slice(0, 3),
        followUps: navData.followUps.slice(0, 3),
        comparisons: navData.reportComparisons.slice(0, 2),
      });
      if (generated?.patientOverview) {
        aiDraft = {
          patientOverview: generated.patientOverview,
          previousConsultationSummary: generated.previousConsultationSummary || deterministicDraft.previousConsultationSummary,
          currentConcerns: generated.currentConcerns || deterministicDraft.currentConcerns,
          relevantMedicalHistory: generated.relevantMedicalHistory || deterministicDraft.relevantMedicalHistory,
          recentReportComparisonSummary: generated.recentReportComparisonSummary || deterministicDraft.recentReportComparisonSummary,
          pendingFollowUpTasks: generated.pendingFollowUpTasks || deterministicDraft.pendingFollowUpTasks,
          suggestedDoctorQuestions: generated.suggestedDoctorQuestions?.length ? generated.suggestedDoctorQuestions : deterministicDraft.suggestedDoctorQuestions,
        };
      }
    }
  } catch (err) {
    logger.warn('AI summary generation failed, using structured clinical deterministic generator:', err.message);
  }

  const summary = await PatientSummary.create({
    patientId,
    doctorId,
    appointmentId: appointmentId || null,
    aiGenerated: {
      ...aiDraft,
      generatedAt: new Date(),
    },
    doctorDraft: {
      ...aiDraft,
      clinicalObservations: '',
      suggestedQuestions: aiDraft.suggestedDoctorQuestions,
    },
    status: PATIENT_SUMMARY_STATUS.AI_GENERATED,
    isApproved: false,
    approvedAt: null,
    sharedWithPatient: false,
  });

  return summary;
}

async function updateAndApproveSummary({ summaryId, doctorId, draftUpdates, approve = false, shareWithPatient = false }) {
  const summary = await PatientSummary.findById(summaryId);
  if (!summary) throw ApiError.notFound('Patient summary not found');

  if (draftUpdates) {
    summary.doctorDraft = {
      ...summary.doctorDraft,
      ...draftUpdates,
    };
    summary.status = PATIENT_SUMMARY_STATUS.DOCTOR_REVIEWED;
  }

  if (approve) {
    summary.isApproved = true;
    summary.approvedAt = new Date();
    summary.status = PATIENT_SUMMARY_STATUS.APPROVED;
  }

  if (shareWithPatient) {
    if (!summary.isApproved) {
      throw ApiError.badRequest('Summary must be approved by the doctor before sharing with patient.');
    }
    summary.sharedWithPatient = true;
    summary.sharedAt = new Date();
    summary.status = PATIENT_SUMMARY_STATUS.SHARED_WITH_PATIENT;

    // Trigger notification
    try {
      const patient = await Patient.findById(summary.patientId);
      if (patient) {
        await notificationService.summaryShared(patient.userId, summary);
      }
    } catch (e) {
      logger.warn('Failed to notify patient of shared summary:', e.message);
    }
  }

  await summary.save();
  return summary;
}

module.exports = {
  getPatientNavigationData,
  generatePatientSummaryDraft,
  updateAndApproveSummary,
};
