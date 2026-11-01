const express = require('express');
const router = express.Router();
const continuityController = require('../controllers/continuityController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { aiLimiter } = require('../middleware/rateLimiter');
const { uploadReport } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

router.use(authenticate);

// ==========================================
// 1. AI REPORT EVOLUTION TRACKER
// ==========================================
router.post(
  '/reports/extract',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.extractReportParameters
);

router.post(
  '/reports/compare',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.compareReports
);

router.get(
  '/reports/comparisons/:patientId?',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.getPatientComparisons
);

router.get(
  '/reports/comparison/:id',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.getComparisonDetail
);

router.patch(
  '/reports/comparison/:id/review',
  authorize(ROLES.DOCTOR),
  continuityController.reviewComparison
);

// ==========================================
// 2. AI PATIENT NAVIGATION & SUMMARY
// ==========================================
router.get(
  '/navigation/:patientId?',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.getPatientNavigation
);

router.post(
  '/navigation/ai-summary',
  authorize(ROLES.DOCTOR),
  aiLimiter,
  continuityController.generateAISummary
);

router.patch(
  '/navigation/summary/:id',
  authorize(ROLES.DOCTOR),
  continuityController.updateAndApproveSummary
);

router.get(
  '/navigation-shared',
  authorize(ROLES.PATIENT),
  continuityController.getSharedSummariesForPatient
);

// ==========================================
// 3. SMART FOLLOW-UP MANAGEMENT
// ==========================================
router.post(
  '/follow-ups',
  authorize(ROLES.DOCTOR),
  continuityController.createFollowUp
);

router.get(
  '/follow-ups/me',
  authorize(ROLES.PATIENT),
  continuityController.getPatientFollowUps
);

router.get(
  '/follow-ups/doctor',
  authorize(ROLES.DOCTOR),
  continuityController.getDoctorFollowUps
);

router.patch(
  '/follow-ups/:id/complete',
  authorize(ROLES.DOCTOR),
  continuityController.completeFollowUp
);

router.patch(
  '/follow-ups/:id/reschedule',
  authorize(ROLES.DOCTOR),
  continuityController.rescheduleFollowUp
);

router.post(
  '/follow-ups/:id/upload',
  authorize(ROLES.PATIENT),
  uploadReport.single('report'),
  continuityController.uploadReportForFollowUp
);

// ==========================================
// 4. MULTI-DOCTOR COLLABORATION & REFERRALS
// ==========================================
router.post(
  '/referrals',
  authorize(ROLES.DOCTOR),
  continuityController.createReferral
);

router.get(
  '/referrals/doctor',
  authorize(ROLES.DOCTOR),
  continuityController.getDoctorReferrals
);

router.get(
  '/referrals/patient',
  authorize(ROLES.PATIENT),
  continuityController.getPatientReferrals
);

router.patch(
  '/referrals/:id/consent',
  authorize(ROLES.PATIENT),
  continuityController.updatePatientConsent
);

router.patch(
  '/referrals/:id/status',
  authorize(ROLES.DOCTOR),
  continuityController.updateReferralStatus
);

// ==========================================
// 5. PATIENT HEALTH JOURNEY TIMELINE
// ==========================================
router.get(
  '/journey/:patientId?',
  authorize(ROLES.PATIENT, ROLES.DOCTOR),
  continuityController.getPatientJourney
);

// ==========================================
// 6. DOCTOR AI COPILOT
// ==========================================
router.post(
  '/copilot',
  authorize(ROLES.DOCTOR),
  aiLimiter,
  continuityController.runCopilot
);

module.exports = router;
