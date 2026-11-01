import api from './api';
import { unwrap } from '../utils/response';

// POST /api/prescriptions (DOCTOR) body: { appointmentId, medicines:[{ name, dosage, frequency, durationDays, notes? }],
//   instructions?, notes? }  — appointment must belong to the doctor.
export const createPrescription = async ({ appointmentId, medicines, instructions, notes }) => {
  const body = { appointmentId, medicines };
  if (instructions) body.instructions = instructions;
  if (notes) body.notes = notes;
  return unwrap(await api.post('/api/prescriptions', body));
};

// GET /api/prescriptions/:id (populated doctorId patientId appointmentId; patient/doctor must own it)
export const getPrescription = async (id) => unwrap(await api.get(`/api/prescriptions/${id}`));
