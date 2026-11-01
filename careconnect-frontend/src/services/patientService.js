import api from './api';
import { unwrap, toPage, toList } from '../utils/response';

// All /api/patients/* routes are PATIENT-only.
export const getMyProfile = async () => unwrap(await api.get('/api/patients/me'));

// Allowed body fields (patientController.updateMe): dateOfBirth, gender, bloodGroup, address,
// emergencyContact, allergies[], medicalHistory[], currentMedicines[]
export const updateMyProfile = async (payload) => unwrap(await api.patch('/api/patients/me', payload));

export const getMyAppointments = async (params = {}) => toPage(unwrap(await api.get('/api/patients/me/appointments', { params })));
export const getMyRecords = async () => toList(unwrap(await api.get('/api/patients/me/records')));
export const getMyAdmissions = async () => toList(unwrap(await api.get('/api/patients/me/admissions')));
export const getMyOrders = async (params = {}) => toPage(unwrap(await api.get('/api/patients/me/orders', { params })));
export const getMyPrescriptions = async () => toList(unwrap(await api.get('/api/patients/me/prescriptions')));
