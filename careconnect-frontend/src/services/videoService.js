import api from './api';
import { unwrap } from '../utils/response';

// POST /api/video/session body: { appointmentId } → { id, roomName, status, appointmentId }
export const createVideoSession = async (appointmentId) =>
  unwrap(await api.post('/api/video/session', { appointmentId }));

// GET /api/video/session/:id → { id, roomName, status, appointmentId, clientToken, iceServers, appointment }
export const getVideoSession = async (id) =>
  unwrap(await api.get(`/api/video/session/${id}`));

// GET /api/video/ice-servers → { iceServers: [...] }
export const getIceServers = async () =>
  unwrap(await api.get('/api/video/ice-servers'));

// POST /api/video/session/:appointmentId/end
export const endVideoSession = async (appointmentId) =>
  unwrap(await api.post(`/api/video/session/${appointmentId}/end`));
