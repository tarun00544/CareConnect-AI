import api from './api';
import { unwrap, toPage, toList } from '../utils/response';

// Router-level guard: HOSPITAL_ADMIN | SUPER_ADMIN. HOSPITAL_ADMIN data is scoped to user.hospitalId server-side.
// SUPER_ADMIN-only: /users, /patients.
export const getDashboard = async () => unwrap(await api.get('/api/admin/dashboard'));
// → { totalPatients, totalDoctors, totalAppointments, totalAdmissions, bedOccupancy:{occupied,total,rate}, emergencyCases, totalRevenuePaise }
export const getAnalytics = async () => unwrap(await api.get('/api/admin/analytics'));
// → { totalPatients, totalDoctors, totalAppointments, totalAdmissions, bedOccupancy, emergencyCases, medicineOrders, revenue(INR) }

export const listUsers = async (params = {}) => toPage(unwrap(await api.get('/api/admin/users', { params }))); //   SUPER_ADMIN, ?role
export const listPatients = async (params = {}) => toPage(unwrap(await api.get('/api/admin/patients', { params }))); // SUPER_ADMIN

export const listAppointments = async (params = {}) => toPage(unwrap(await api.get('/api/admin/appointments', { params })));
export const listAdmissions = async (params = {}) => toPage(unwrap(await api.get('/api/admin/admissions', { params })));
export const listBeds = async () => toList(unwrap(await api.get('/api/admin/beds')));
export const listEmergency = async () => toList(unwrap(await api.get('/api/admin/emergency')));

// ---- Doctors (HOSPITAL_ADMIN: own hospital · SUPER_ADMIN: all) ---------------------------------
// list params: q, departmentId, specialization, status(ACTIVE|ON_LEAVE|INACTIVE), verification(PENDING|VERIFIED|REJECTED),
//              account(ACTIVE|PENDING_VERIFICATION|SUSPENDED), page, limit
export const listDoctors = async (params = {}) => toPage(unwrap(await api.get('/api/admin/doctors', { params })));
export const getAdminDoctor = async (id) => unwrap(await api.get(`/api/admin/doctors/${id}`));
// → { doctor, invitation:{ inviteUrl, expiresAt, delivery } }   (hospitalId is derived server-side)
export const createDoctor = async (payload) => unwrap(await api.post('/api/admin/doctors', payload));
export const updateDoctor = async (id, payload) => unwrap(await api.patch(`/api/admin/doctors/${id}`, payload));
// → { doctor, affectedUpcomingAppointments }
export const setDoctorStatus = async (id, status) => unwrap(await api.patch(`/api/admin/doctors/${id}/status`, { status }));
export const resendDoctorInvite = async (id) => unwrap(await api.post(`/api/admin/doctors/${id}/invite`));
export const recordDoctorVerification = async (id, decision, notes) => unwrap(await api.patch(`/api/admin/doctors/${id}/verification`, { decision, notes }));
export const getDoctorFormContext = async (hospitalId) => unwrap(await api.get('/api/admin/doctor-form-context', { params: hospitalId ? { hospitalId } : {} }));
export const createDepartment = async (payload) => unwrap(await api.post('/api/admin/departments', payload));

export const uploadDoctorDocument = async (id, file, { type, title }, onProgress) => {
  const fd = new FormData();
  fd.append('type', type);
  if (title) fd.append('title', title);
  fd.append('document', file);
  return unwrap(await api.post(`/api/admin/doctors/${id}/documents`, fd, {
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
  }));
};
export const deleteDoctorDocument = async (id, docId) => unwrap(await api.delete(`/api/admin/doctors/${id}/documents/${docId}`));
// Documents are private: fetched with the auth header as a blob, then saved locally.
export async function downloadDoctorDocument(id, doc) {
  const res = await api.get(`/api/admin/doctors/${id}/documents/${doc._id}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.originalName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---- Users (SUPER_ADMIN) ------------------------------------------------------------------------
// list params: q, role, status(ACTIVE|SUSPENDED|PENDING_VERIFICATION|DELETED), page, limit
export const getUser = async (id) => unwrap(await api.get(`/api/admin/users/${id}`));
// body: { name?, phone?, email?, role?, hospitalId? } — role changes are limited to staff roles server-side.
export const updateUser = async (id, payload) => unwrap(await api.patch(`/api/admin/users/${id}`, payload));
export const setUserStatus = async (id, status) => unwrap(await api.patch(`/api/admin/users/${id}/status`, { status }));
// Safe deletion = anonymisation; the server requires the user's email as confirmation.
export const deleteUser = async (id, confirmEmail) => unwrap(await api.delete(`/api/admin/users/${id}`, { data: { confirmEmail } }));
export const listAuditLogs = async (params = {}) => toPage(unwrap(await api.get('/api/admin/audit-logs', { params })));
