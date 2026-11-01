const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const EmergencyCase = require('../models/EmergencyCase');
const Hospital = require('../models/Hospital');
const { getOwnPatientRecord } = require('./patientController');
const { ROLES, EMERGENCY_STATUS } = require('../config/constants');
const notificationService = require('../services/notificationService');

// Prototype emergency coordination flow: patient request -> nearest/available
// hospital lookup -> department assignment. This is NOT integrated with any
// real emergency dispatch service; see the API documentation note in the
// README about this limitation.
const createEmergency = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientRecord(req.user._id);

  // Naive "nearest hospital" placeholder: picks the first active hospital.
  // A real implementation would use geospatial queries against hospital
  // coordinates and live bed/ER capacity.
  const hospital = await Hospital.findOne({ status: 'ACTIVE' });

  const emergencyCase = await EmergencyCase.create({
    patientId: patient._id,
    hospitalId: hospital ? hospital._id : null,
    emergencyType: req.body.emergencyType,
    location: req.body.location,
    status: hospital ? EMERGENCY_STATUS.DISPATCHED : EMERGENCY_STATUS.REQUESTED,
  });

  const io = req.app.get('io');
  if (io && hospital) {
    io.to(`hospital:${hospital._id}`).emit('emergency:new', emergencyCase);
  }

  new ApiResponse(201, emergencyCase, 'Emergency request received. Seek immediate in-person care if this is life-threatening.').send(res);
});

const getEmergency = asyncHandler(async (req, res) => {
  const emergencyCase = await EmergencyCase.findById(req.params.id).populate('hospitalId departmentId doctorId');
  if (!emergencyCase) throw ApiError.notFound('Emergency case not found');

  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    if (String(emergencyCase.patientId) !== String(patient._id)) throw ApiError.forbidden('Access denied');
  } else if (req.user.role === ROLES.HOSPITAL_ADMIN) {
    if (String(emergencyCase.hospitalId) !== String(req.user.hospitalId)) throw ApiError.forbidden('Access denied');
  }

  new ApiResponse(200, emergencyCase).send(res);
});

const updateStatus = asyncHandler(async (req, res) => {
  const emergencyCase = await EmergencyCase.findById(req.params.id);
  if (!emergencyCase) throw ApiError.notFound('Emergency case not found');

  emergencyCase.status = req.body.status;
  if (req.body.departmentId) emergencyCase.departmentId = req.body.departmentId;
  if (req.body.doctorId) emergencyCase.doctorId = req.body.doctorId;
  await emergencyCase.save();

  const Patient = require('../models/Patient');
  const patient = await Patient.findById(emergencyCase.patientId);
  if (patient) await notificationService.emergencyUpdate(patient.userId, emergencyCase._id, emergencyCase.status);

  new ApiResponse(200, emergencyCase, 'Emergency case updated').send(res);
});

module.exports = { createEmergency, getEmergency, updateStatus };
