import api from './api';
import { unwrap } from '../utils/response';

// POST /api/admissions  (only PATIENT actually works — controller resolves the caller's Patient profile)
// body: { hospitalId, departmentId, doctorId?, reason, admissionForm?: {} (free-form Mixed object) }
export const createAdmission = async ({ hospitalId, departmentId, doctorId, reason, admissionForm }) => {
  const body = { hospitalId, departmentId, reason, admissionForm: admissionForm || {} };
  if (doctorId) body.doctorId = doctorId;
  return unwrap(await api.post('/api/admissions', body));
};

// GET /api/admissions/:id (populated hospitalId departmentId doctorId roomId bedId)
export const getAdmission = async (id) => unwrap(await api.get(`/api/admissions/${id}`));

// PATCH /api/admissions/:id/status (DOCTOR | HOSPITAL_ADMIN | SUPER_ADMIN) body: { status }
export const updateAdmissionStatus = async (id, status) => unwrap(await api.patch(`/api/admissions/${id}/status`, { status }));

// POST /api/admissions/:admissionId/documents  multipart: field `document` (file), optional `title` → Admission
export const uploadAdmissionDocument = async (admissionId, file, { title, onProgress } = {}) => {
  const fd = new FormData();
  fd.append('document', file);
  if (title) fd.append('title', title);
  return unwrap(
    await api.post(`/api/admissions/${admissionId}/documents`, fd, {
      onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    })
  );
};
