const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const storageService = require('../utils/storageService');
const MedicalRecord = require('../models/MedicalRecord');
const Admission = require('../models/Admission');
const { getOwnPatientRecord } = require('./patientController');
const { ROLES } = require('../config/constants');

// Report uploads become MedicalRecord entries owned by the uploading
// patient (or, if a doctor uploads on the patient's behalf during a visit,
// linked to that appointment).
const uploadReport = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const { url } = await storageService.save(req.file);

  let patientId = req.body.patientId;
  if (req.user.role === ROLES.PATIENT) {
    const patient = await getOwnPatientRecord(req.user._id);
    patientId = patient._id;
  }
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const record = await MedicalRecord.create({
    patientId,
    doctorId: req.body.doctorId || null,
    appointmentId: req.body.appointmentId || null,
    type: req.body.type || 'LAB_REPORT',
    title: req.body.title || req.file.originalname,
    description: req.body.description,
    fileUrl: url,
  });

  new ApiResponse(201, record, 'Report uploaded').send(res);
});

const uploadAdmissionDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const { url } = await storageService.save(req.file);

  const admission = await Admission.findById(req.params.admissionId);
  if (!admission) throw ApiError.notFound('Admission not found');

  admission.documents.push({ title: req.body.title || req.file.originalname, fileUrl: url });
  await admission.save();

  new ApiResponse(201, admission, 'Document uploaded').send(res);
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const { url } = await storageService.save(req.file);
  new ApiResponse(201, { url }, 'Profile image uploaded').send(res);
});

module.exports = { uploadReport, uploadAdmissionDocument, uploadProfileImage };
