const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    genericName: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    manufacturer: { type: String, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: null },
    requiresPrescription: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

medicineSchema.index({ name: 'text', genericName: 'text' });

module.exports = mongoose.model('Medicine', medicineSchema);
