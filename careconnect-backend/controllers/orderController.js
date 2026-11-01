const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Order = require('../models/Order');
const Patient = require('../models/Patient');
const orderService = require('../services/orderService');
const { getOwnPatientRecord } = require('./patientController');
const notificationService = require('../services/notificationService');
const { ROLES } = require('../config/constants');

const createOrder = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const order = await orderService.placeOrder({
    patientId: patient._id,
    items: req.body.items,
    shippingAddress: req.body.shippingAddress,
  });
  new ApiResponse(201, order, 'Order placed').send(res);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const orders = await Order.find({ patientId: patient._id }).sort({ createdAt: -1 });
  new ApiResponse(200, orders).send(res);
});

// GET /api/orders (PHARMACY_ADMIN | SUPER_ADMIN)
const listOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders({
    page: req.query.page,
    limit: req.query.limit,
    orderStatus: req.query.orderStatus,
    paymentStatus: req.query.paymentStatus,
    deliveryStatus: req.query.deliveryStatus,
    q: req.query.q,
  });
  new ApiResponse(200, result).send(res);
});

// GET /api/orders/:id
// Strict role-based isolation: Patient (own order only), PHARMACY_ADMIN, or SUPER_ADMIN.
// Unauthorized roles (Doctor, Hospital Admin, etc.) receive 403 Forbidden.
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate({
    path: 'patientId',
    select: 'userId medicalRecordNumber',
    populate: { path: 'userId', select: 'name email phone' },
  });
  if (!order) throw ApiError.notFound('Order not found');

  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    const orderPatientId = String(order.patientId?._id || order.patientId);
    if (orderPatientId !== String(patient._id)) {
      throw ApiError.forbidden('Access denied to this order');
    }
  } else if (req.user.role !== ROLES.PHARMACY_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Access denied to pharmacy orders');
  }

  new ApiResponse(200, order).send(res);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { orderStatus: req.body.orderStatus },
    { new: true }
  );
  if (!order) throw ApiError.notFound('Order not found');

  const patient = await Patient.findById(order.patientId);
  if (patient) {
    await notificationService.medicineOrder(patient.userId, order._id, order.orderStatus);
  }

  new ApiResponse(200, order, 'Order status updated').send(res);
});

const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { deliveryStatus: req.body.deliveryStatus },
    { new: true }
  );
  if (!order) throw ApiError.notFound('Order not found');

  const patient = await Patient.findById(order.patientId);
  if (patient) {
    await notificationService.deliveryUpdate(patient.userId, order._id, order.deliveryStatus);
  }

  new ApiResponse(200, order, 'Delivery status updated').send(res);
});

module.exports = {
  createOrder,
  getMyOrders,
  listOrders,
  getOrder,
  updateOrderStatus,
  updateDeliveryStatus,
};
