const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const { createAppointmentValidator, rescheduleValidator, statusValidator } = require('../validators/appointmentValidators');
const { mongoIdParam } = require('../validators/commonValidators');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorize(ROLES.PATIENT), createAppointmentValidator, validate, appointmentController.createAppointment);
router.get('/my', appointmentController.getMyAppointments);
router.get('/:id', mongoIdParam(), validate, appointmentController.getAppointment);
router.patch('/:id/status', authorize(ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN), statusValidator, validate, appointmentController.updateStatus);
router.patch('/:id/reschedule', rescheduleValidator, validate, appointmentController.reschedule);
router.delete('/:id', mongoIdParam(), validate, appointmentController.cancelAppointment);

module.exports = router;
