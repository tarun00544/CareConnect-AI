const mongoose = require('mongoose');

const prescribedMedicineSchema = new mongoose.Schema(
  {
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    name: { type: String, required: true },
    dosage: { type: String, required: true }, // e.g. "500mg"
    frequency: { type: String, required: true }, // e.g. "twice daily"
    durationDays: { type: Number, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    medicines: { type: [prescribedMedicineSchema], required: true },
    instructions: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
