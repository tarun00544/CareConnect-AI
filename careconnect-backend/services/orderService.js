const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const ApiError = require('../utils/ApiError');
const prescriptionService = require('./prescriptionService');
const notificationService = require('./notificationService');

// Enforces the "requiresPrescription" workflow: any item flagged as
// prescription-only must carry a verified prescriptionId belonging to the
// ordering patient. This check cannot be bypassed by client-supplied prices
// or flags — both come from the Medicine catalog record, not the request.
async function placeOrder({ patientId, items, shippingAddress }) {
  if (!items || items.length === 0) throw ApiError.badRequest('Order must contain at least one item');

  let subtotal = 0;
  const resolvedItems = [];

  for (const item of items) {
    const medicine = await Medicine.findById(item.medicineId);
    if (!medicine || medicine.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Medicine ${item.medicineId} is not available`);
    }
    if (medicine.stock < item.quantity) {
      throw ApiError.badRequest(`Insufficient stock for ${medicine.name}`);
    }

    if (medicine.requiresPrescription) {
      if (!item.prescriptionId) {
        throw ApiError.badRequest(`${medicine.name} requires a valid prescription`);
      }
      await prescriptionService.verifyPrescriptionForOrder(item.prescriptionId, patientId);
    }

    const lineTotal = medicine.price * item.quantity;
    subtotal += lineTotal;

    resolvedItems.push({
      medicineId: medicine._id,
      name: medicine.name,
      quantity: item.quantity,
      unitPrice: medicine.price, // server-authoritative price, never client-supplied
      requiresPrescription: medicine.requiresPrescription,
      prescriptionId: item.prescriptionId || null,
    });
  }

  const deliveryFee = subtotal > 500 ? 0 : 40;
  const total = subtotal + deliveryFee;

  // Atomic stock validation and deduction with automatic rollback on concurrency conflict
  const decremented = [];
  const lowStockItems = [];

  try {
    for (const item of resolvedItems) {
      const updated = await Medicine.findOneAndUpdate(
        { _id: item.medicineId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        throw ApiError.badRequest(`Insufficient stock for ${item.name}`);
      }
      decremented.push({ medicineId: item.medicineId, quantity: item.quantity });
      if (updated.stock <= 10) {
        lowStockItems.push(updated);
      }
    }
  } catch (err) {
    // Rollback already decremented items
    await Promise.all(
      decremented.map((d) =>
        Medicine.findByIdAndUpdate(d.medicineId, { $inc: { stock: d.quantity } })
      )
    );
    throw err;
  }

  const order = await Order.create({
    patientId,
    items: resolvedItems,
    shippingAddress,
    subtotal,
    deliveryFee,
    total,
  });

  // Real-time and persistent notification to Pharmacy Admins
  try {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(patientId).populate('userId', 'name');
    const patientName = patient?.userId?.name || 'A patient';
    await notificationService.newMedicineOrderPharmacy(order, patientName);

    // Notify pharmacy admins of low stock alerts
    for (const lowMed of lowStockItems) {
      await notificationService.lowStockAlert(lowMed);
    }
  } catch (notifErr) {
    console.warn('Failed to dispatch pharmacy order notifications:', notifErr);
  }

  return order;
}

async function listOrders({ page = 1, limit = 20, orderStatus, paymentStatus, deliveryStatus, q } = {}) {
  const filter = {};
  if (orderStatus) filter.orderStatus = orderStatus;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (deliveryStatus) filter.deliveryStatus = deliveryStatus;
  if (q && q.trim()) {
    const trimmed = q.trim();
    if (/^[a-f0-9]{24}$/i.test(trimmed)) {
      filter._id = trimmed;
    }
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'patientId',
        select: 'userId medicalRecordNumber',
        populate: { path: 'userId', select: 'name email phone' },
      }),
    Order.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

module.exports = { placeOrder, listOrders };
