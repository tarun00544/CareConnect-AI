const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { ROLES } = require('../config/constants');

router.use(authenticate, authorize(ROLES.PATIENT));

router.get('/me', patientController.getMe);
router.patch('/me', patientController.updateMe);
router.get('/me/appointments', patientController.getMyAppointments);
router.get('/me/records', patientController.getMyRecords);
router.get('/me/admissions', patientController.getMyAdmissions);
router.get('/me/orders', patientController.getMyOrders);
router.get('/me/prescriptions', patientController.getMyPrescriptions);

module.exports = router;
