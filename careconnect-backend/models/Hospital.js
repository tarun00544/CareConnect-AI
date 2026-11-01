const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    contact: {
      phone: String,
      email: String,
    },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    facilities: [{ type: String, trim: true }],
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
