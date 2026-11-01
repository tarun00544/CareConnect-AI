import api from './api';
import { unwrap, toList } from '../utils/response';

// GET /api/rooms?hospitalId (any authenticated user) → Room[] { _id, hospitalId, roomNumber, roomType, floor, status }
export const listRooms = async (params = {}) => toList(unwrap(await api.get('/api/rooms', { params })));
