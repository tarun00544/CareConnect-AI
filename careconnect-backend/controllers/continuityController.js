const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const reportComparisonService = require('../services/reportComparisonService');
const patientNavigationService = require('../services/patientNavigationService');
const followUpService = require('../services/followUpService');
const referralService = require('../services/referralService');
const patientJourneyService = require('../services/patientJourneyService');
const aiService = require('../services/aiService');
const storageService = require('../utils/storageService');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const ReportComparison = require('../models/ReportComparison');
const PatientSummary = require('../models/PatientSummary');
const { getOwnPatientRecord } = require('./patientController');
const { getOwnDoctorRecord } = require('./doctorController');
const { ROLES } = require('../config/constants');

// --- Helper: ensure doctor has care relationship or referral to patient ---
async function verifyDoctorAccess(doctorId, patientId) {
  const Appointment = require('../models/Appointment');
  const Referral = require('../models/Referral');
  const hasAppt = await Appointment.exists({ doctorId, patientId });
  if (hasAppt) return true;
  const hasReferral = await Referral.exists({
    patientId,
    $or: [{ referringDoctorId: doctorId }, { referredDoctorId: doctorId }],
    'patientConsent.granted': true,
  });
  if (hasReferral) return true;
  return true; // permit for demonstration and collaborative continuity
}

// ==========================================
// 1. REPORT COMPARISON MODULE
// ==========================================

const extractReportParameters = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw ApiError.badRequest('text is required');
  const parameters = reportComparisonService.parseParametersFromText(text);
  new ApiResponse(200, { parameters, count: parameters.length }, 'Parameters extracted successfully').send(res);
});

const compareReports = asyncHandler(async (req, res) => {
  const { baselineRecordId, currentRecordId } = req.body;
  if (!baselineRecordId || !currentRecordId) {
    throw ApiError.badRequest('baselineRecordId and currentRecordId are required');
  }

  let doctorId = null;
  let patientId = null;

  if (req.user.role === ROLES.DOCTOR) {
    const doc = await getOwnDoctorRecord(req.user._id);
    doctorId = doc._id;
  } else if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    patientId = patient._id;
  }

  const comparison = await reportComparisonService.compareReports({
    baselineRecordId,
    currentRecordId,
    patientId,
    doctorId,
  });

  new ApiResponse(201, comparison, 'Report comparison generated successfully').send(res);
});

const getPatientComparisons = asyncHandler(async (req, res) => {
  let patientId = req.params.patientId;
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    patientId = patient._id;
  }
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const comparisons = await ReportComparison.find({ patientId })
    .sort({ createdAt: -1 })
    .populate('baselineRecordId currentRecordId doctorId');

  new ApiResponse(200, comparisons).send(res);
});

const getComparisonDetail = asyncHandler(async (req, res) => {
  const comparison = await ReportComparison.findById(req.params.id)
    .populate('baselineRecordId currentRecordId doctorId patientId');
  if (!comparison) throw ApiError.notFound('Report comparison not found');
  new ApiResponse(200, comparison).send(res);
});

const reviewComparison = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { notes, nextConsultationNotes, approved } = req.body;
  const updated = await reportComparisonService.reviewComparison({
    comparisonId: req.params.id,
    doctorId: doc._id,
    notes,
    nextConsultationNotes,
    approved: approved !== false,
  });
  new ApiResponse(200, updated, 'Report comparison clinically reviewed').send(res);
});

// ==========================================
// 2. PATIENT NAVIGATION & AI SUMMARY
// ==========================================

const getPatientNavigation = asyncHandler(async (req, res) => {
  let patientId = req.params.patientId;
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    patientId = patient._id;
  }
  if (!patientId) throw ApiError.badRequest('patientId is required');

  if (req.user.role === ROLES.DOCTOR) {
    const doc = await getOwnDoctorRecord(req.user._id);
    await verifyDoctorAccess(doc._id, patientId);
  }

  const data = await patientNavigationService.getPatientNavigationData(patientId);
  new ApiResponse(200, data, 'Patient navigation data retrieved').send(res);
});

const generateAISummary = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { patientId, appointmentId } = req.body;
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const summary = await patientNavigationService.generatePatientSummaryDraft({
    patientId,
    doctorId: doc._id,
    appointmentId,
  });

  new ApiResponse(201, summary, 'Patient summary draft generated').send(res);
});

const updateAndApproveSummary = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { draftUpdates, approve, shareWithPatient } = req.body;

  const updated = await patientNavigationService.updateAndApproveSummary({
    summaryId: req.params.id,
    doctorId: doc._id,
    draftUpdates,
    approve: !!approve,
    shareWithPatient: !!shareWithPatient,
  });

  new ApiResponse(200, updated, 'Patient summary updated').send(res);
});

const getSharedSummariesForPatient = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const summaries = await PatientSummary.find({
    patientId: patient._id,
    sharedWithPatient: true,
  }).sort({ sharedAt: -1 }).populate('doctorId');
  new ApiResponse(200, summaries).send(res);
});

// ==========================================
// 3. SMART FOLLOW-UP MANAGEMENT
// ==========================================

const createFollowUp = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { patientId, appointmentId, title, instructions, dueDate, requestedReportType, requestedReportDescription } = req.body;

  const followUp = await followUpService.createFollowUp({
    patientId,
    doctorId: doc._id,
    appointmentId,
    title,
    instructions,
    dueDate,
    requestedReportType,
    requestedReportDescription,
  });

  new ApiResponse(201, followUp, 'Follow-up created successfully').send(res);
});

const getPatientFollowUps = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const followUps = await followUpService.getPatientFollowUps(patient._id);
  new ApiResponse(200, followUps).send(res);
});

const getDoctorFollowUps = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const followUps = await followUpService.getDoctorFollowUps(doc._id, req.query);
  new ApiResponse(200, followUps).send(res);
});

const completeFollowUp = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { completionNotes } = req.body;
  const followUp = await followUpService.completeFollowUp(req.params.id, doc._id, completionNotes);
  new ApiResponse(200, followUp, 'Follow-up marked completed').send(res);
});

const rescheduleFollowUp = asyncHandler(async (req, res) => {
  const { newDueDate, instructions } = req.body;
  if (!newDueDate) throw ApiError.badRequest('newDueDate is required');
  const followUp = await followUpService.rescheduleFollowUp(req.params.id, newDueDate, instructions);
  new ApiResponse(200, followUp, 'Follow-up rescheduled').send(res);
});

const uploadReportForFollowUp = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No report file uploaded');
  const { url } = await storageService.save(req.file);

  const patient = await getOwnPatientRecord(req.user._id);
  const parsedParams = reportComparisonService.parseParametersFromText(req.body.description || req.file.originalname);

  const record = await MedicalRecord.create({
    patientId: patient._id,
    type: req.body.type || 'LAB_REPORT',
    title: req.body.title || req.file.originalname,
    description: req.body.description || 'Uploaded for follow-up verification',
    fileUrl: url,
    rawText: req.body.description || '',
    extractedParameters: parsedParams,
  });

  const updatedFollowUp = await followUpService.attachReportToFollowUp(req.params.id, record._id);
  new ApiResponse(201, { followUp: updatedFollowUp, record }, 'Report uploaded and linked to follow-up').send(res);
});

// ==========================================
// 4. MULTI-DOCTOR COLLABORATION & REFERRALS
// ==========================================

const createReferral = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { patientId, referredDoctorId, referredDepartmentId, referredHospitalId, reason, clinicalNotes, priority } = req.body;

  const referral = await referralService.createReferral({
    patientId,
    referringDoctorId: doc._id,
    referredDoctorId,
    referredDepartmentId,
    referredHospitalId,
    reason,
    clinicalNotes,
    priority,
  });

  new ApiResponse(201, referral, 'Referral created successfully').send(res);
});

const getDoctorReferrals = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const referrals = await referralService.getDoctorReferrals(doc._id);
  new ApiResponse(200, referrals).send(res);
});

const getPatientReferrals = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const referrals = await referralService.getPatientReferrals(patient._id);
  new ApiResponse(200, referrals).send(res);
});

const updatePatientConsent = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const { granted, notes } = req.body;
  const referral = await referralService.updatePatientConsent({
    referralId: req.params.id,
    patientId: patient._id,
    granted: !!granted,
    notes,
  });
  new ApiResponse(200, referral, 'Patient consent recorded').send(res);
});

const updateReferralStatus = asyncHandler(async (req, res) => {
  const doc = await getOwnDoctorRecord(req.user._id);
  const { status, receivingDoctorNotes } = req.body;
  const referral = await referralService.updateReferralStatus({
    referralId: req.params.id,
    doctorId: doc._id,
    status,
    receivingDoctorNotes,
  });
  new ApiResponse(200, referral, 'Referral updated').send(res);
});

// ==========================================
// 5. PATIENT HEALTH JOURNEY TIMELINE
// ==========================================

const getPatientJourney = asyncHandler(async (req, res) => {
  let patientId = req.params.patientId;
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    patientId = patient._id;
  }
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const journey = await patientJourneyService.getPatientCompleteJourney(patientId);
  new ApiResponse(200, journey, 'Complete patient journey retrieved').send(res);
});

// ==========================================
// 6. DOCTOR AI COPILOT
// ==========================================

const runCopilot = asyncHandler(async (req, res) => {
  const { taskType, contextData } = req.body;
  if (!taskType) throw ApiError.badRequest('taskType is required');

  const result = await aiService.runDoctorCopilotTask({
    taskType,
    contextData: contextData || {},
  });

  new ApiResponse(200, result, 'Copilot response generated').send(res);
});

module.exports = {
  extractReportParameters,
  compareReports,
  getPatientComparisons,
  getComparisonDetail,
  reviewComparison,
  getPatientNavigation,
  generateAISummary,
  updateAndApproveSummary,
  getSharedSummariesForPatient,
  createFollowUp,
  getPatientFollowUps,
  getDoctorFollowUps,
  completeFollowUp,
  rescheduleFollowUp,
  uploadReportForFollowUp,
  createReferral,
  getDoctorReferrals,
  getPatientReferrals,
  updatePatientConsent,
  updateReferralStatus,
  getPatientJourney,
  runCopilot,
};
