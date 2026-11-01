import api from './api';
import { unwrap } from '../utils/response';

// ==========================================
// 1. AI REPORT EVOLUTION TRACKER
// ==========================================
export const extractReportParameters = async (text) => {
  return unwrap(await api.post('/api/continuity/reports/extract', { text }));
};

export const compareReports = async ({ baselineRecordId, currentRecordId }) => {
  return unwrap(await api.post('/api/continuity/reports/compare', { baselineRecordId, currentRecordId }));
};

export const getPatientComparisons = async (patientId = '') => {
  const url = patientId ? `/api/continuity/reports/comparisons/${patientId}` : '/api/continuity/reports/comparisons';
  return unwrap(await api.get(url));
};

export const getComparisonDetail = async (id) => {
  return unwrap(await api.get(`/api/continuity/reports/comparison/${id}`));
};

export const reviewComparison = async (id, { notes, nextConsultationNotes, approved }) => {
  return unwrap(await api.patch(`/api/continuity/reports/comparison/${id}/review`, { notes, nextConsultationNotes, approved }));
};

// ==========================================
// 2. PATIENT NAVIGATION & AI SUMMARY
// ==========================================
export const getPatientNavigation = async (patientId = '') => {
  const url = patientId ? `/api/continuity/navigation/${patientId}` : '/api/continuity/navigation';
  return unwrap(await api.get(url));
};

export const generateAISummary = async ({ patientId, appointmentId }) => {
  return unwrap(await api.post('/api/continuity/navigation/ai-summary', { patientId, appointmentId }));
};

export const updateAndApproveSummary = async (id, { draftUpdates, approve, shareWithPatient }) => {
  return unwrap(await api.patch(`/api/continuity/navigation/summary/${id}`, { draftUpdates, approve, shareWithPatient }));
};

export const getSharedSummaries = async () => {
  return unwrap(await api.get('/api/continuity/navigation-shared'));
};

// ==========================================
// 3. SMART FOLLOW-UP MANAGEMENT
// ==========================================
export const createFollowUp = async (data) => {
  return unwrap(await api.post('/api/continuity/follow-ups', data));
};

export const getMyFollowUps = async () => {
  return unwrap(await api.get('/api/continuity/follow-ups/me'));
};

export const getDoctorFollowUps = async (params = {}) => {
  return unwrap(await api.get('/api/continuity/follow-ups/doctor', { params }));
};

export const completeFollowUp = async (id, completionNotes = '') => {
  return unwrap(await api.patch(`/api/continuity/follow-ups/${id}/complete`, { completionNotes }));
};

export const rescheduleFollowUp = async (id, { newDueDate, instructions }) => {
  return unwrap(await api.patch(`/api/continuity/follow-ups/${id}/reschedule`, { newDueDate, instructions }));
};

export const uploadFollowUpReport = async (id, file, { title, description, type, onProgress } = {}) => {
  const form = new FormData();
  form.append('report', file);
  if (title) form.append('title', title);
  if (description) form.append('description', description);
  if (type) form.append('type', type);

  return unwrap(
    await api.post(`/api/continuity/follow-ups/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    })
  );
};

// ==========================================
// 4. MULTI-DOCTOR COLLABORATION & REFERRALS
// ==========================================
export const createReferral = async (data) => {
  return unwrap(await api.post('/api/continuity/referrals', data));
};

export const getDoctorReferrals = async () => {
  return unwrap(await api.get('/api/continuity/referrals/doctor'));
};

export const getPatientReferrals = async () => {
  return unwrap(await api.get('/api/continuity/referrals/patient'));
};

export const updatePatientConsent = async (id, { granted, notes }) => {
  return unwrap(await api.patch(`/api/continuity/referrals/${id}/consent`, { granted, notes }));
};

export const updateReferralStatus = async (id, { status, receivingDoctorNotes }) => {
  return unwrap(await api.patch(`/api/continuity/referrals/${id}/status`, { status, receivingDoctorNotes }));
};

// ==========================================
// 5. PATIENT HEALTH JOURNEY TIMELINE
// ==========================================
export const getPatientJourney = async (patientId = '') => {
  const url = patientId ? `/api/continuity/journey/${patientId}` : '/api/continuity/journey';
  return unwrap(await api.get(url));
};

// ==========================================
// 6. DOCTOR AI COPILOT
// ==========================================
export const runCopilotTask = async ({ taskType, contextData }) => {
  return unwrap(await api.post('/api/continuity/copilot', { taskType, contextData }));
};
