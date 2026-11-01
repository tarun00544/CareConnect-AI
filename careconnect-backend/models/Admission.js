const mongoose = require('mongoose');
const { ADMISSION_STATUS } = require('../config/constants');

const admissionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    bedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bed', default: null },
    admissionDate: { type: Date, default: null },
    dischargeDate: { type: Date, default: null },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(ADMISSION_STATUS), default: ADMISSION_STATUS.REQUESTED },
    admissionForm: {
      type: mongoose.Schema.Types.Mixed, // structured intake form data
      default: {},
    },
    documents: [
      {
        title: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

admissionSchema.index({ hospitalId: 1, status: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
