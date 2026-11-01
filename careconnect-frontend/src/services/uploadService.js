import api from './api';
import { unwrap } from '../utils/response';

const withProgress = (onProgress) => ({
  onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
});

// POST /api/uploads/report  multipart: `report` (file) + optional type (LAB_REPORT|IMAGING|PRESCRIPTION|DISCHARGE_SUMMARY|OTHER),
//   title, description, doctorId, appointmentId (patients are resolved server-side) → MedicalRecord { fileUrl: '/uploads/reports/…' }
export const uploadReport = async (file, { type, title, description, doctorId, appointmentId, onProgress } = {}) => {
  const fd = new FormData();
  fd.append('report', file);
  if (type) fd.append('type', type);
  if (title) fd.append('title', title);
  if (description) fd.append('description', description);
  if (doctorId) fd.append('doctorId', doctorId);
  if (appointmentId) fd.append('appointmentId', appointmentId);
  return unwrap(await api.post('/api/uploads/report', fd, withProgress(onProgress)));
};

// POST /api/uploads/profile-image  multipart: `image` → { url }
// The backend stores the file but does not link it to any profile field yet, so no UI persists it.
export const uploadProfileImage = async (file, onProgress) => {
  const fd = new FormData();
  fd.append('image', file);
  return unwrap(await api.post('/api/uploads/profile-image', fd, withProgress(onProgress)));
};
// Admission documents: see admissionService.uploadAdmissionDocument
