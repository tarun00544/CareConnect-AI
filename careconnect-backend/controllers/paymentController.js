const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Payment = require('../models/Payment');
const paymentService = require('../services/paymentService');
const receiptService = require('../services/receiptService');
const { ROLES } = require('../config/constants');

const createOrder = asyncHandler(async (req, res) => {
  const { type, referenceId } = req.body;
  const result = await paymentService.createPaymentOrder({ userId: req.user._id, type, referenceId });
  new ApiResponse(201, result, 'Razorpay order created').send(res);
});

const verify = asyncHandler(async (req, res) => {
  const payment = await paymentService.verifyPayment(req.body);
  const receipt = receiptService.generateReceipt({
    type: payment.type,
    referenceId: payment.referenceId,
    patient: { id: req.user._id, name: req.user.name },
    amount: payment.amount / 100,
    currency: payment.currency,
    status: payment.status,
    transactionId: payment.razorpayPaymentId,
    date: payment.verifiedAt,
  });
  new ApiResponse(200, { payment, receipt }, 'Payment verified successfully').send(res);
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (req.user.role !== ROLES.SUPER_ADMIN && String(payment.userId) !== String(req.user._id)) {
    throw ApiError.forbidden('Access denied');
  }
  new ApiResponse(200, payment).send(res);
});

const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });
  new ApiResponse(200, payments).send(res);
});

module.exports = { createOrder, verify, getPayment, getMyPayments };
