import api from './api';
import { unwrap, toList } from '../utils/response';

// GET /api/departments (public) query: hospitalId → Department[] { _id, name, description, hospitalId:{_id,name}, status }
export const listDepartments = async (params = {}) => toList(unwrap(await api.get('/api/departments', { params })));
export const getDepartment = async (id) => unwrap(await api.get(`/api/departments/${id}`));
