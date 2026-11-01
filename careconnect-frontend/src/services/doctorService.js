import api from './api';
import { unwrap, toPage, toList } from '../utils/response';

// GET /api/doctors  (public)  query: departmentId, hospitalId, specialization(regex, case-insens), page, limit(<=100)
// Items: { _id, userId:{_id,name,email,phone}, departmentId:{...}, hospitalId:{...}, qualification, specialization,
//          experience, consultationFee, bio, availability[{dayOfWeek,startTime,endTime,slotDurationMinutes}], status }
export const listDoctors = async ({ departmentId, hospitalId, specialization, page, limit } = {}) => {
  const params = {};
  if (departmentId) params.departmentId = departmentId;
  if (hospitalId) params.hospitalId = hospitalId;
  // The backend escapes this itself (matches primary or additional specializations, case-insensitive).
  if (specialization) params.specialization = specialization;
  if (page) params.page = page;
  if (limit) params.limit = limit;
  return toPage(unwrap(await api.get('/api/doctors', { params })));
};

export const getDoctor = async (id) => unwrap(await api.get(`/api/doctors/${id}`));

// GET /api/doctors/:id/availability?date=YYYY-MM-DD → { date, slots:[{ startTime, endTime, available }] }
export const getAvailability = async (id, date) => unwrap(await api.get(`/api/doctors/${id}/availability`, { params: { date } }));

// ---- DOCTOR-only -------------------------------------------------
// GET /api/doctors/me/appointments (paginated; patientId populated with userId{name,email,phone})
export const getMyDoctorAppointments = async (params = {}) => toPage(unwrap(await api.get('/api/doctors/me/appointments', { params })));
// GET /api/doctors/me/patients → Patient[] (userId populated with name/email/phone)
export const getMyPatients = async () => toList(unwrap(await api.get('/api/doctors/me/patients')));
// PATCH /api/doctors/me/availability body: { availability: [{ dayOfWeek, startTime, endTime, slotDurationMinutes }] }
export const updateMyAvailability = async (availability) => unwrap(await api.patch('/api/doctors/me/availability', { availability }));

// GET /api/doctors/me (DOCTOR) → the doctor's own profile, even while not yet listed publicly
// (inactive / awaiting verification). Returns null when the account has no doctor profile.
export async function findMyDoctorProfile() {
  try {
    return unwrap(await api.get('/api/doctors/me'));
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

// GET /api/doctors/meta/options (public) → { professionalCategories, specializations, departmentSuggestions, languages,
//   consultationModes, documentTypes, verificationPolicy }  — the single source for the Add/Edit Doctor form.
export const getDoctorOptions = async () => unwrap(await api.get('/api/doctors/meta/options'));

// ---- Directory cache (doctorId → doctor with name) -----------------
// Appointments/prescriptions/conversations populate `doctorId` without the user's name, so patient-facing
// screens resolve names from the public doctor list. Cached per session.
let directoryPromise = null;
export function getDoctorDirectory({ force = false } = {}) {
  if (force) directoryPromise = null;
  if (!directoryPromise) {
    directoryPromise = (async () => {
      const map = {};
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await listDoctors({ page, limit: 100 });
        res.items.forEach((d) => { map[d._id] = d; });
        if (page >= res.pagination.totalPages || page >= 10) break;
        page += 1;
      }
      return map;
    })().catch((e) => {
      directoryPromise = null;
      throw e;
    });
  }
  return directoryPromise;
}
