const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

departmentSchema.index({ hospitalId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
