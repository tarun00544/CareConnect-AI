const mongoose = require('mongoose');
const { BED_STATUS } = require('../config/constants');

const bedSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    bedNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(BED_STATUS), default: BED_STATUS.AVAILABLE },
    assignedPatientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  },
  { timestamps: true }
);

bedSchema.index({ roomId: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ hospitalId: 1, status: 1 });

// Ensures a bed cannot be assigned to two active patients at once: only one
// document per bed may simultaneously carry status OCCUPIED (paired with
// bedService's transactional allocate/release flow).
bedSchema.index(
  { _id: 1, assignedPatientId: 1 },
  { unique: true, partialFilterExpression: { status: 'OCCUPIED' } }
);

module.exports = mongoose.model('Bed', bedSchema);
