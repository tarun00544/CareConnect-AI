const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['APPOINTMENT', 'ORDER'], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Appointment or Order _id
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null, select: false },
    amount: { type: Number, required: true, min: 0 }, // in smallest currency unit (paise)
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
