import api from './api';
import { unwrap } from '../utils/response';

// A "consultation" is the IN_PROGRESS phase of an Appointment (there is no separate collection).
// POST /api/consultations body: { appointmentId } → sets status IN_PROGRESS
export const startConsultation = async (appointmentId) => unwrap(await api.post('/api/consultations', { appointmentId }));
// GET /api/consultations/:id (id = appointment id; populated doctorId patientId)
export const getConsultation = async (id) => unwrap(await api.get(`/api/consultations/${id}`));
// PATCH /api/consultations/:id body: { notes?, status? } (notes REPLACE the existing value)
export const updateConsultation = async (id, payload) => unwrap(await api.patch(`/api/consultations/${id}`, payload));
// POST /api/consultations/:id/notes body: { notes } (appended on a new line)
export const addConsultationNotes = async (id, notes) => unwrap(await api.post(`/api/consultations/${id}/notes`, { notes }));
