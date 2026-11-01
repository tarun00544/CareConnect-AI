const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'], default: 'UNKNOWN' },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    allergies: [{ type: String, trim: true }],
    medicalHistory: [{ type: String, trim: true }],
    currentMedicines: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
