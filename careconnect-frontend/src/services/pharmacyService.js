import api from './api';
import { unwrap, toPage } from '../utils/response';

// GET /api/medicines (public) query: category (exact), search ($text on name/genericName), page, limit(<=100)
// NOTE: only status ACTIVE medicines are ever returned.
// Medicine: { _id, name, genericName, category, manufacturer, description, price, stock, image, requiresPrescription, status }
export const listMedicines = async ({ category, search, page, limit } = {}) => {
  const params = {};
  if (category) params.category = category;
  if (search) params.search = search;
  if (page) params.page = page;
  if (limit) params.limit = limit;
  return toPage(unwrap(await api.get('/api/medicines', { params })));
};
export const getMedicine = async (id) => unwrap(await api.get(`/api/medicines/${id}`));

// PHARMACY_ADMIN | SUPER_ADMIN
export const createMedicine = async (payload) => unwrap(await api.post('/api/medicines', payload));
export const updateMedicine = async (id, payload) => unwrap(await api.patch(`/api/medicines/${id}`, payload));
// DELETE marks the medicine DISCONTINUED (soft delete)
export const discontinueMedicine = async (id) => api.delete(`/api/medicines/${id}`);
