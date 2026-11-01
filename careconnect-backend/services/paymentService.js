const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { PAYMENT_STATUS } = require('../config/constants');
const notificationService = require('./notificationService');

const razorpay = env.razorpay.keyId
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

// The amount charged is ALWAYS derived server-side from the referenced
// Appointment/Order record — never trusted from the client request body.
// This closes the "client can send any amount/status" attack surface.
async function createPaymentOrder({ userId, type, referenceId }) {
  if (!razorpay) throw ApiError.internal('Payment gateway is not configured');

  let amountInRupees;
  if (type === 'APPOINTMENT') {
    const Doctor = require('../models/Doctor');
    const appointment = await Appointment.findById(referenceId);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    const doctor = await Doctor.findById(appointment.doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    amountInRupees = doctor.consultationFee;
  } else if (type === 'ORDER') {
    const order = await Order.findById(referenceId);
    if (!order) throw ApiError.notFound('Order not found');
    amountInRupees = order.total;
  } else {
    throw ApiError.badRequest('Invalid payment type');
  }

  const amountInPaise = Math.round(amountInRupees * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `${type}_${referenceId}_${Date.now()}`,
    notes: { type, referenceId: String(referenceId), userId: String(userId) },
  });

  const payment = await Payment.create({
    userId,
    type,
    referenceId,
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: 'INR',
    status: PAYMENT_STATUS.PENDING,
  });

  return { payment, razorpayOrder, keyId: env.razorpay.keyId };
}

// Verifies the Razorpay signature server-side (HMAC SHA256 of
// order_id|payment_id using the Razorpay key secret) before ever marking a
// payment/appointment/order as paid. This is the only trusted source of
// truth for payment status — client-reported "success" is never honored on
// its own.
async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!env.razorpay.keySecret) throw ApiError.internal('Payment gateway is not configured');

  const expectedSignature = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    await Payment.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, { status: PAYMENT_STATUS.FAILED });
    throw ApiError.badRequest('Payment signature verification failed');
  }

  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: PAYMENT_STATUS.PAID,
      verifiedAt: new Date(),
    },
    { new: true }
  );
  if (!payment) throw ApiError.notFound('Payment record not found');

  if (payment.type === 'APPOINTMENT') {
    const appointment = await Appointment.findByIdAndUpdate(
      payment.referenceId,
      { paymentStatus: PAYMENT_STATUS.PAID, paymentId: payment._id, status: 'CONFIRMED' },
      { new: true }
    );
    if (appointment) {
      const Patient = require('../models/Patient');
      const patient = await Patient.findById(appointment.patientId);
      if (patient) await notificationService.appointmentConfirmed(patient.userId, appointment);
    }
  } else if (payment.type === 'ORDER') {
    await Order.findByIdAndUpdate(payment.referenceId, {
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentId: payment._id,
      orderStatus: 'CONFIRMED',
    });
  }

  await notificationService.paymentConfirmed(payment.userId, payment._id);

  return payment;
}

module.exports = { createPaymentOrder, verifyPayment };
