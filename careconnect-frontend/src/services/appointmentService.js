import api from './api';
import { unwrap, toPage } from '../utils/response';

// POST /api/appointments (PATIENT) body: { doctorId, date(ISO8601), startTime 'HH:mm', endTime 'HH:mm',
//   consultationType?: IN_PERSON|VIDEO|CHAT (default VIDEO), notes? }  → 201 Appointment (unpopulated)
// 409 when slot already booked.
export const createAppointment = async ({ doctorId, date, startTime, endTime, consultationType, notes }) => {
  const body = { doctorId, date, startTime, endTime };
  if (consultationType) body.consultationType = consultationType;
  if (notes) body.notes = notes;
  return unwrap(await api.post('/api/appointments', body));
};

// GET /api/appointments/my (PATIENT or DOCTOR only) → { items, pagination } (populated doctorId hospitalId departmentId patientId)
export const getMyAppointments = async (params = {}) => toPage(unwrap(await api.get('/api/appointments/my', { params })));

// GET /api/appointments/:id (populated: doctorId hospitalId departmentId patientId)
export const getAppointment = async (id) => unwrap(await api.get(`/api/appointments/${id}`));

// PATCH /api/appointments/:id/status (DOCTOR | HOSPITAL_ADMIN | SUPER_ADMIN) body: { status } — RESCHEDULED not accepted
export const updateAppointmentStatus = async (id, status) => unwrap(await api.patch(`/api/appointments/${id}/status`, { status }));

// PATCH /api/appointments/:id/reschedule body: { date, startTime, endTime } → sets status RESCHEDULED
export const rescheduleAppointment = async (id, { date, startTime, endTime }) =>
  unwrap(await api.patch(`/api/appointments/${id}/reschedule`, { date, startTime, endTime }));

// DELETE /api/appointments/:id → marks the appointment CANCELLED (soft cancel)
export const cancelAppointment = async (id) => unwrap(await api.delete(`/api/appointments/${id}`));
