import api from './api';
import { unwrap } from '../utils/response';

// POST /api/emergency (PATIENT) body: { emergencyType (required), location?: { lat, lng, address } }
// → EmergencyCase. Prototype coordination only — it is NOT connected to real emergency dispatch.
export const createEmergency = async ({ emergencyType, location }) => {
  const body = { emergencyType };
  if (location) body.location = location;
  return unwrap(await api.post('/api/emergency', body));
};
// GET /api/emergency/:id (populated hospitalId departmentId doctorId)
export const getEmergency = async (id) => unwrap(await api.get(`/api/emergency/${id}`));
// PATCH /api/emergency/:id/status (HOSPITAL_ADMIN | DOCTOR | SUPER_ADMIN) body: { status, departmentId?, doctorId? }
export const updateEmergencyStatus = async (id, payload) => unwrap(await api.patch(`/api/emergency/${id}/status`, payload));
