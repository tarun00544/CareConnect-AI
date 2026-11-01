import api from './api';
import { unwrap } from '../utils/response';

// POST /api/auth/register  body: { name, email, password(>=8), phone?, role? }  → { user, accessToken, refreshToken }
// Backend only honours role PATIENT | DOCTOR (anything else becomes PATIENT), and only creates a Patient
// profile for PATIENT — a self-registered DOCTOR has no Doctor profile. The UI therefore registers patients only.
export const register = async ({ name, email, password, phone }) => {
  const body = { name, email, password };
  if (phone) body.phone = phone;
  return unwrap(await api.post('/api/auth/register', body));
};

// POST /api/auth/login  body: { email, password } → { user, accessToken, refreshToken }
export const login = async ({ email, password }) => unwrap(await api.post('/api/auth/login', { email, password }));

// GET /api/auth/me → { id, name, email, phone, role, status }
export const getMe = async () => unwrap(await api.get('/api/auth/me'));

// POST /api/auth/logout (auth) — bumps tokenVersion, revoking all refresh tokens
export const logout = async () => api.post('/api/auth/logout');

// POST /api/auth/refresh is handled centrally by services/api.js (single-flight, automatic).

// Doctor onboarding: GET /api/auth/invitations/:token → { name, email, expiresAt };
// POST /api/auth/accept-invitation { token, password } → { email }
export const getInvitation = async (token) => unwrap(await api.get(`/api/auth/invitations/${encodeURIComponent(token)}`));
export const acceptInvitation = async ({ token, password }) => unwrap(await api.post('/api/auth/accept-invitation', { token, password }));
