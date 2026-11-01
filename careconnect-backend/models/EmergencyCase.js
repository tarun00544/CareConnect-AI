const mongoose = require('mongoose');
const { EMERGENCY_STATUS } = require('../config/constants');

const emergencyCaseSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    emergencyType: { type: String, trim: true, required: true },
    status: { type: String, enum: Object.values(EMERGENCY_STATUS), default: EMERGENCY_STATUS.REQUESTED },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

emergencyCaseSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyCase', emergencyCaseSchema);
