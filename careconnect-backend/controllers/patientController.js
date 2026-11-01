const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Admission = require('../models/Admission');
const Order = require('../models/Order');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');

async function getOwnPatientRecord(userId) {
  const patient = await Patient.findOne({ userId });
  if (!patient) throw ApiError.notFound('Patient profile not found');
  return patient;
}

const getMe = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  new ApiResponse(200, patient).send(res);
});

const updateMe = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const allowedFields = ['dateOfBirth', 'gender', 'bloodGroup', 'address', 'emergencyContact', 'allergies', 'medicalHistory', 'currentMedicines'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) patient[field] = req.body[field];
  });
  await patient.save();
  new ApiResponse(200, patient, 'Profile updated').send(res);
});

const getMyAppointments = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Appointment.find({ patientId: patient._id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'doctorId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          { path: 'departmentId', select: 'name' },
        ],
      })
      .populate('hospitalId departmentId'),
    Appointment.countDocuments({ patientId: patient._id }),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const getMyRecords = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const records = await MedicalRecord.find({ patientId: patient._id }).sort({ createdAt: -1 });
  new ApiResponse(200, records).send(res);
});

const getMyAdmissions = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const admissions = await Admission.find({ patientId: patient._id }).sort({ createdAt: -1 });
  new ApiResponse(200, admissions).send(res);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Order.find({ patientId: patient._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments({ patientId: patient._id }),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const getMyPrescriptions = asyncHandler(async (req, res) => {
  const Prescription = require('../models/Prescription');
  const patient = await getOwnPatientRecord(req.user._id);
  const prescriptions = await Prescription.find({ patientId: patient._id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'doctorId',
      populate: [
        { path: 'userId', select: 'name email' },
        { path: 'departmentId', select: 'name' },
      ],
    })
    .populate('appointmentId');
  new ApiResponse(200, prescriptions).send(res);
});

module.exports = {
  getMe,
  updateMe,
  getMyAppointments,
  getMyRecords,
  getMyAdmissions,
  getMyOrders,
  getMyPrescriptions,
  getOwnPatientRecord,
};
