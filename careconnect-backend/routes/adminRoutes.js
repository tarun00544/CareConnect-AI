const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const doctorAdmin = require('../controllers/doctorAdminController');
const userAdmin = require('../controllers/userAdminController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { uploadDoctorDocument } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/commonValidators');
const { ROLES } = require('../config/constants');

router.use(authenticate, authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN));

router.get('/dashboard', adminController.dashboard);

// ---- Users (SUPER_ADMIN only) ----
const superOnly = authorize(ROLES.SUPER_ADMIN);
router.get('/users', superOnly, userAdmin.list);
router.get('/users/:id', superOnly, mongoIdParam(), validate, userAdmin.get);
router.patch('/users/:id', superOnly, mongoIdParam(), validate, userAdmin.update);
router.patch('/users/:id/status', superOnly, mongoIdParam(), validate, userAdmin.setStatus);
router.delete('/users/:id', superOnly, mongoIdParam(), validate, userAdmin.remove);
router.get('/audit-logs', superOnly, userAdmin.auditLogs);

// ---- Doctors (HOSPITAL_ADMIN scoped to own hospital, SUPER_ADMIN everywhere) ----
router.get('/doctor-form-context', doctorAdmin.getContext);
router.get('/doctors', doctorAdmin.list);
router.post('/doctors', doctorAdmin.create);
router.get('/doctors/:id', mongoIdParam(), validate, doctorAdmin.get);
router.patch('/doctors/:id', mongoIdParam(), validate, doctorAdmin.update);
router.patch('/doctors/:id/status', mongoIdParam(), validate, doctorAdmin.setStatus);
router.post('/doctors/:id/invite', mongoIdParam(), validate, doctorAdmin.resendInvite);
router.patch('/doctors/:id/verification', mongoIdParam(), validate, doctorAdmin.verify);
router.post('/doctors/:id/documents', mongoIdParam(), validate, uploadDoctorDocument.single('document'), doctorAdmin.uploadDocument);
router.get('/doctors/:id/documents/:docId', mongoIdParam(), mongoIdParam('docId'), validate, doctorAdmin.downloadDocument);
router.delete('/doctors/:id/documents/:docId', mongoIdParam(), mongoIdParam('docId'), validate, doctorAdmin.deleteDocument);

// ---- Departments (a hospital only has the departments it creates) ----
router.post('/departments', doctorAdmin.createDepartment);

router.get('/patients', superOnly, adminController.listPatients);
router.get('/appointments', adminController.listAppointments);
router.get('/admissions', adminController.listAdmissions);
router.get('/beds', adminController.listBeds);
router.get('/emergency', adminController.listEmergency);
router.get('/analytics', adminController.analytics);

module.exports = router;
