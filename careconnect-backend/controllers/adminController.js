const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Admission = require('../models/Admission');
const Bed = require('../models/Bed');
const EmergencyCase = require('../models/EmergencyCase');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');
const { ROLES, PAYMENT_STATUS, BED_STATUS } = require('../config/constants');

// Scopes a query to the acting admin's hospital when they are a
// HOSPITAL_ADMIN; SUPER_ADMIN sees everything. This is the enforcement
// point for "hospital admins should only access data according to their
// hospital role."
function scopeToHospital(filter, user) {
  if (user.role === ROLES.HOSPITAL_ADMIN) {
    // A hospital admin with no hospital assigned must see NOTHING (previously this fell
    // through to an unscoped query, i.e. every hospital's data).
    return { ...filter, hospitalId: user.hospitalId || null };
  }
  return filter;
}

const dashboard = asyncHandler(async (req, res) => {
  const hospitalFilter = scopeToHospital({}, req.user);
  const [totalPatients, totalDoctors, totalAppointments, totalAdmissions, occupiedBeds, totalBeds, emergencyCases, revenueAgg] = await Promise.all([
    Patient.countDocuments({}),
    Doctor.countDocuments(scopeToHospital({}, req.user)),
    Appointment.countDocuments(hospitalFilter),
    Admission.countDocuments(hospitalFilter),
    Bed.countDocuments(scopeToHospital({ status: BED_STATUS.OCCUPIED }, req.user)),
    Bed.countDocuments(scopeToHospital({}, req.user)),
    EmergencyCase.countDocuments(hospitalFilter),
    Payment.aggregate([{ $match: { status: PAYMENT_STATUS.PAID } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  new ApiResponse(200, {
    totalPatients,
    totalDoctors,
    totalAppointments,
    totalAdmissions,
    bedOccupancy: { occupied: occupiedBeds, total: totalBeds, rate: totalBeds ? occupiedBeds / totalBeds : 0 },
    emergencyCases,
    totalRevenuePaise: revenueAgg[0]?.total || 0,
  }).send(res);
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const [items, total] = await Promise.all([
    User.find(filter).select('-passwordHash').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const listDoctors = asyncHandler(async (req, res) => {
  const filter = scopeToHospital({}, req.user);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Doctor.find(filter).populate('userId', 'name email phone').skip(skip).limit(limit),
    Doctor.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const listPatients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Patient.find({}).populate('userId', 'name email phone').skip(skip).limit(limit),
    Patient.countDocuments({}),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const listAppointments = asyncHandler(async (req, res) => {
  const filter = scopeToHospital({}, req.user);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ date: -1 }).skip(skip).limit(limit).populate('doctorId patientId hospitalId'),
    Appointment.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const listAdmissions = asyncHandler(async (req, res) => {
  const filter = scopeToHospital({}, req.user);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Admission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('patientId hospitalId'),
    Admission.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const listBeds = asyncHandler(async (req, res) => {
  const filter = scopeToHospital({}, req.user);
  const beds = await Bed.find(filter).populate('roomId');
  new ApiResponse(200, beds).send(res);
});

const listEmergency = asyncHandler(async (req, res) => {
  const filter = scopeToHospital({}, req.user);
  const cases = await EmergencyCase.find(filter).sort({ createdAt: -1 }).populate('patientId hospitalId');
  new ApiResponse(200, cases).send(res);
});

const analytics = asyncHandler(async (req, res) => {
  const hospitalFilter = scopeToHospital({}, req.user);
  const [totalPatients, totalDoctors, totalAppointments, totalAdmissions, occupiedBeds, totalBeds, emergencyCases, medicineOrders, revenueAgg] = await Promise.all([
    Patient.countDocuments({}),
    Doctor.countDocuments(scopeToHospital({}, req.user)),
    Appointment.countDocuments(hospitalFilter),
    Admission.countDocuments(hospitalFilter),
    Bed.countDocuments(scopeToHospital({ status: BED_STATUS.OCCUPIED }, req.user)),
    Bed.countDocuments(scopeToHospital({}, req.user)),
    EmergencyCase.countDocuments(hospitalFilter),
    Order.countDocuments({}),
    Payment.aggregate([{ $match: { status: PAYMENT_STATUS.PAID } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  new ApiResponse(200, {
    totalPatients,
    totalDoctors,
    totalAppointments,
    totalAdmissions,
    bedOccupancy: { occupied: occupiedBeds, total: totalBeds, rate: totalBeds ? occupiedBeds / totalBeds : 0 },
    emergencyCases,
    medicineOrders,
    revenue: (revenueAgg[0]?.total || 0) / 100,
  }).send(res);
});

module.exports = { dashboard, listUsers, listDoctors, listPatients, listAppointments, listAdmissions, listBeds, listEmergency, analytics };
