const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');
const audit = require('../utils/auditService');
const svc = require('../services/doctorAdminService');
const scheduleService = require('../services/scheduleService');
const {
  PROFESSIONAL_CATEGORIES, SPECIALIZATIONS, DEPARTMENT_SUGGESTIONS, LANGUAGES,
} = require('../config/specializations');
const { CONSULTATION_MODES, DOCUMENT_TYPES } = require('../config/constants');

// Public: configuration the Add/Edit Doctor form is built from.
const getOptions = asyncHandler(async (req, res) => {
  new ApiResponse(200, {
    professionalCategories: PROFESSIONAL_CATEGORIES,
    specializations: SPECIALIZATIONS,
    departmentSuggestions: DEPARTMENT_SUGGESTIONS,
    languages: LANGUAGES,
    consultationModes: Object.values(CONSULTATION_MODES),
    documentTypes: Object.values(DOCUMENT_TYPES),
    verificationPolicy: scheduleService.verificationRequired() ? 'required' : 'optional',
  }).send(res);
});

const list = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const { items, total } = await svc.listDoctors(req.user, req.query, pg);
  new ApiResponse(200, buildPaginatedResult(items, total, pg.page, pg.limit)).send(res);
});

const get = asyncHandler(async (req, res) => {
  new ApiResponse(200, await svc.getDoctor(req.user, req.params.id)).send(res);
});

const create = asyncHandler(async (req, res) => {
  const { doctor, invitation, hospitalId, changes } = await svc.createDoctor(req.user, req.body || {});
  await audit.record(req, { action: 'DOCTOR_CREATED', targetType: 'Doctor', targetId: doctor._id, hospitalId, summary: `Created doctor ${doctor.userId?.email}`, changes });
  new ApiResponse(201, { doctor, invitation }, 'Doctor created. Share the invitation link so they can set a password.').send(res);
});

const update = asyncHandler(async (req, res) => {
  const { doctor, changes, hospitalId } = await svc.updateDoctor(req.user, req.params.id, req.body || {});
  await audit.record(req, { action: 'DOCTOR_UPDATED', targetType: 'Doctor', targetId: doctor._id, hospitalId, summary: 'Updated doctor profile', changes });
  new ApiResponse(200, doctor, 'Doctor updated').send(res);
});

const setStatus = asyncHandler(async (req, res) => {
  const r = await svc.setStatus(req.user, req.params.id, req.body?.status);
  await audit.record(req, { action: 'DOCTOR_STATUS_CHANGED', targetType: 'Doctor', targetId: r.doctor._id, hospitalId: r.hospitalId, summary: `Status ${r.previous.doctorStatus} → ${r.current.doctorStatus}`, changes: { previous: r.previous, current: r.current } });
  new ApiResponse(200, { doctor: await svc.getDoctor(req.user, req.params.id), affectedUpcomingAppointments: r.affectedUpcomingAppointments }, 'Doctor status updated').send(res);
});

const resendInvite = asyncHandler(async (req, res) => {
  const { invitation, hospitalId, doctorId } = await svc.resendInvitation(req.user, req.params.id);
  await audit.record(req, { action: 'DOCTOR_INVITE_ISSUED', targetType: 'Doctor', targetId: doctorId, hospitalId, summary: 'Issued a new account invitation' });
  new ApiResponse(200, { invitation }, 'New invitation issued').send(res);
});

const verify = asyncHandler(async (req, res) => {
  const r = await svc.recordVerification(req.user, req.params.id, req.body || {});
  await audit.record(req, { action: 'DOCTOR_VERIFICATION_RECORDED', targetType: 'Doctor', targetId: r.doctor._id, hospitalId: r.hospitalId, summary: `Verification ${r.previous} → ${req.body.decision}`, changes: { decision: req.body.decision, notes: req.body.notes } });
  new ApiResponse(200, r.doctor, 'Verification decision recorded').send(res);
});

const uploadDocument = asyncHandler(async (req, res) => {
  const r = await svc.addDocument(req.user, req.params.id, req.file, req.body || {});
  await audit.record(req, { action: 'DOCTOR_DOCUMENT_UPLOADED', targetType: 'Doctor', targetId: r.doctorId, hospitalId: r.hospitalId, summary: `Uploaded ${r.document.type}`, changes: { type: r.document.type, name: r.document.originalName, size: r.document.size } });
  new ApiResponse(201, r.document, 'Document uploaded').send(res);
});

const deleteDocument = asyncHandler(async (req, res) => {
  const r = await svc.removeDocument(req.user, req.params.id, req.params.docId);
  await audit.record(req, { action: 'DOCTOR_DOCUMENT_DELETED', targetType: 'Doctor', targetId: req.params.id, hospitalId: r.hospitalId, summary: `Deleted ${r.meta.type}`, changes: { ...r.meta, verificationReset: r.verificationReset } });
  new ApiResponse(200, { verificationReset: r.verificationReset }, 'Document deleted').send(res);
});

// Authenticated, role- and hospital-checked download of a private document.
const downloadDocument = asyncHandler(async (req, res) => {
  const f = await svc.getDocumentFile(req.user, req.params.id, req.params.docId);
  await audit.record(req, { action: 'DOCTOR_DOCUMENT_VIEWED', targetType: 'Doctor', targetId: f.doctorId, hospitalId: f.hospitalId, summary: `Downloaded ${f.meta.type}` });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(f.path, f.name);
});

const createDepartment = asyncHandler(async (req, res) => {
  const r = await svc.createDepartment(req.user, req.body || {});
  await audit.record(req, { action: 'DEPARTMENT_CREATED', targetType: 'Department', targetId: r.department._id, hospitalId: r.hospitalId, summary: `Created department ${r.department.name}` });
  new ApiResponse(201, r.department, 'Department created').send(res);
});

// The hospital(s) + departments the caller may add doctors to (powers the Add Doctor form).
const getContext = asyncHandler(async (req, res) => {
  const Hospital = require('../models/Hospital');
  const Department = require('../models/Department');
  const { ROLES } = require('../config/constants');
  if (req.user.role === ROLES.HOSPITAL_ADMIN) {
    if (!req.user.hospitalId) throw require('../utils/ApiError').forbidden('Your account is not assigned to a hospital');
    const [hospital, departments] = await Promise.all([
      Hospital.findById(req.user.hospitalId).select('name'),
      Department.find({ hospitalId: req.user.hospitalId, status: 'ACTIVE' }).select('name').sort({ name: 1 }),
    ]);
    return new ApiResponse(200, { hospitals: hospital ? [hospital] : [], departments, fixedHospital: true }).send(res);
  }
  const hospitals = await Hospital.find({ status: 'ACTIVE' }).select('name').sort({ name: 1 });
  const hid = req.query.hospitalId;
  const departments = hid && /^[a-f\d]{24}$/i.test(hid)
    ? await Department.find({ hospitalId: hid, status: 'ACTIVE' }).select('name').sort({ name: 1 })
    : await Department.find({ status: 'ACTIVE' }).select('name hospitalId').sort({ name: 1 });
  return new ApiResponse(200, { hospitals, departments, fixedHospital: false }).send(res);
});

module.exports = { getContext, getOptions, list, get, create, update, setStatus, resendInvite, verify, uploadDocument, deleteDocument, downloadDocument, createDepartment };
