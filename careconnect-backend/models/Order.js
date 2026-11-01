const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    requiresPrescription: { type: Boolean, default: false },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    orderStatus: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PLACED },
    deliveryStatus: { type: String, enum: ['NOT_DISPATCHED', 'IN_TRANSIT', 'DELIVERED'], default: 'NOT_DISPATCHED' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
