import api from './api';
import { unwrap, toList } from '../utils/response';

// GET /api/beds/available?hospitalId&roomId (any authenticated user) → Bed[] (roomId populated) — AVAILABLE only
export const listAvailableBeds = async (params = {}) => toList(unwrap(await api.get('/api/beds/available', { params })));
// POST /api/beds/allocate (HOSPITAL_ADMIN | DOCTOR | SUPER_ADMIN) body: { bedId, admissionId } → 409 when no longer available
export const allocateBed = async ({ bedId, admissionId }) => unwrap(await api.post('/api/beds/allocate', { bedId, admissionId }));
// PATCH /api/beds/:id/status (HOSPITAL_ADMIN | SUPER_ADMIN) body: { status } (AVAILABLE|OCCUPIED|RESERVED|MAINTENANCE)
export const updateBedStatus = async (id, status) => unwrap(await api.patch(`/api/beds/${id}/status`, { status }));
// POST /api/beds/release (HOSPITAL_ADMIN | DOCTOR | SUPER_ADMIN) body: { bedId }
export const releaseBed = async (bedId) => unwrap(await api.post('/api/beds/release', { bedId }));
