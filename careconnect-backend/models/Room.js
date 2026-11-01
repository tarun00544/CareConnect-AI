const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    roomNumber: { type: String, required: true, trim: true },
    roomType: { type: String, enum: ['GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'EMERGENCY'], required: true },
    floor: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

roomSchema.index({ hospitalId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
