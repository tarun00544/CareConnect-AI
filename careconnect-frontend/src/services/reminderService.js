import api from './api';
import { unwrap, toList } from '../utils/response';

// GET /api/schedules/my (PATIENT)
export const getMySchedules = async ({ activeOnly = false } = {}) => {
  const params = activeOnly ? { active: 'true' } : {};
  return toList(unwrap(await api.get('/api/schedules/my', { params })));
};

// GET /api/schedules/reminders/today (PATIENT)
export const getTodayReminders = async ({ date, timezone } = {}) => {
  const params = {};
  if (date) params.date = date;
  if (timezone) params.timezone = timezone;
  return unwrap(await api.get('/api/schedules/reminders/today', { params }));
};

// PATCH /api/schedules/reminders/:logId/taken (PATIENT)
export const confirmTaken = async (logId) => {
  return unwrap(await api.patch(`/api/schedules/reminders/${logId}/taken`));
};

// PATCH /api/schedules/reminders/:logId/snooze (PATIENT)
export const snoozeReminder = async (logId, snoozeMinutes = 15) => {
  return unwrap(await api.patch(`/api/schedules/reminders/${logId}/snooze`, { snoozeMinutes }));
};

// PATCH /api/schedules/reminders/:logId/skip (PATIENT)
export const skipReminder = async (logId, reason = '') => {
  return unwrap(await api.patch(`/api/schedules/reminders/${logId}/skip`, { reason }));
};

// PATCH /api/schedules/:scheduleId/refill (PATIENT)
export const configureRefillReminder = async (scheduleId, { enabled, remindDaysBefore = 3 }) => {
  return unwrap(await api.patch(`/api/schedules/${scheduleId}/refill`, { enabled, remindDaysBefore }));
};

// GET /api/schedules/adherence (PATIENT)
export const getAdherenceStats = async (days = 7) => {
  return unwrap(await api.get('/api/schedules/adherence', { params: { days } }));
};

// GET /api/preferences (ALL AUTH USERS)
export const getUserPreferences = async () => {
  return unwrap(await api.get('/api/preferences'));
};

// PUT /api/preferences (ALL AUTH USERS)
export const updateUserPreferences = async (preferences) => {
  return unwrap(await api.put('/api/preferences', preferences));
};

// POST /api/devices/register
export const registerDeviceToken = async (payload) => {
  return unwrap(await api.post('/api/devices/register', payload));
};

// DELETE /api/devices/:token
export const removeDeviceToken = async (token) => {
  return unwrap(await api.delete(`/api/devices/${encodeURIComponent(token)}`));
};

// POST /api/schedules (DOCTOR)
export const createSchedule = async (scheduleData) => {
  return unwrap(await api.post('/api/schedules', scheduleData));
};

// GET /api/schedules/patient/:patientId (DOCTOR)
export const getDoctorPatientSchedules = async (patientId) => {
  return toList(unwrap(await api.get(`/api/schedules/patient/${patientId}`)));
};

// GET /api/schedules/adherence/patient/:patientId (DOCTOR)
export const getDoctorPatientAdherence = async (patientId, days = 7) => {
  return unwrap(await api.get(`/api/schedules/adherence/patient/${patientId}`, { params: { days } }));
};
