const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const doctorAdminController = require('../controllers/doctorAdminController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { ROLES } = require('../config/constants');

// NOTE: fixed paths (/meta/options, /me*) must be registered before '/:id'.
router.get('/meta/options', doctorAdminController.getOptions);
router.get('/', doctorController.listDoctors);
router.get('/me', authenticate, authorize(ROLES.DOCTOR), doctorController.getMe);
router.get('/me/appointments', authenticate, authorize(ROLES.DOCTOR), doctorController.getMyAppointments);
router.get('/me/patients', authenticate, authorize(ROLES.DOCTOR), doctorController.getMyPatients);
router.patch('/me/availability', authenticate, authorize(ROLES.DOCTOR), doctorController.updateMyAvailability);
router.get('/:id', optionalAuthenticate, doctorController.getDoctor);
router.get('/:id/availability', doctorController.getAvailability);

module.exports = router;
