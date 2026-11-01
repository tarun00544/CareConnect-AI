const Prescription = require('../models/Prescription');
const Medicine = require('../models/Medicine');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notificationService');
const Patient = require('../models/Patient');

async function createPrescription({ patientId, doctorId, appointmentId, medicines, instructions, notes }) {
  // Best-effort enrichment: attach medicineId when a catalog match exists,
  // without blocking prescription creation for medicines not in the catalog.
  const enriched = await Promise.all(
    medicines.map(async (m) => {
      const match = await Medicine.findOne({ name: new RegExp(`^${m.name}$`, 'i') });
      return { ...m, medicineId: match ? match._id : undefined };
    })
  );

  const prescription = await Prescription.create({
    patientId,
    doctorId,
    appointmentId,
    medicines: enriched,
    instructions,
    notes,
  });

  const patient = await Patient.findById(patientId);
  if (patient) await notificationService.prescriptionUploaded(patient.userId, prescription._id);

  return prescription;
}

async function verifyPrescriptionForOrder(prescriptionId, patientId) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw ApiError.badRequest('Referenced prescription not found');
  if (String(prescription.patientId) !== String(patientId)) {
    throw ApiError.forbidden('Prescription does not belong to this patient');
  }
  return prescription;
}

module.exports = { createPrescription, verifyPrescriptionForOrder };
