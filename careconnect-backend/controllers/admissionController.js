const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Admission = require('../models/Admission');
const { getOwnPatientRecord } = require('./patientController');
const { ROLES, ADMISSION_STATUS } = require('../config/constants');
const notificationService = require('../services/notificationService');

const createAdmission = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);
  const admission = await Admission.create({
    patientId: patient._id,
    hospitalId: req.body.hospitalId,
    departmentId: req.body.departmentId,
    doctorId: req.body.doctorId,
    reason: req.body.reason,
    admissionForm: req.body.admissionForm || {},
  });
  new ApiResponse(201, admission, 'Admission requested').send(res);
});

async function assertAdmissionAccess(admission, user) {
  if (user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(user._id);
    if (String(admission.patientId) !== String(patient._id)) throw ApiError.forbidden('Access denied');
  } else if (user.role === ROLES.HOSPITAL_ADMIN) {
    if (String(admission.hospitalId) !== String(user.hospitalId)) throw ApiError.forbidden('Access denied');
  }
}

const getAdmission = asyncHandler(async (req, res) => {
  const admission = await Admission.findById(req.params.id).populate('hospitalId departmentId doctorId roomId bedId');
  if (!admission) throw ApiError.notFound('Admission not found');
  await assertAdmissionAccess(admission, req.user);
  new ApiResponse(200, admission).send(res);
});

const updateStatus = asyncHandler(async (req, res) => {
  const admission = await Admission.findById(req.params.id);
  if (!admission) throw ApiError.notFound('Admission not found');
  await assertAdmissionAccess(admission, req.user);

  admission.status = req.body.status;
  if (req.body.status === ADMISSION_STATUS.ADMITTED) admission.admissionDate = new Date();
  if (req.body.status === ADMISSION_STATUS.DISCHARGED) admission.dischargeDate = new Date();
  await admission.save();

  if (req.body.status === ADMISSION_STATUS.APPROVED) {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(admission.patientId);
    if (patient) await notificationService.admissionApproved(patient.userId, admission._id);
  }

  new ApiResponse(200, admission, 'Admission status updated').send(res);
});

module.exports = { createAdmission, getAdmission, updateStatus, assertAdmissionAccess };
