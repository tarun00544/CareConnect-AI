const express = require('express');
const router = express.Router();
const medicineScheduleController = require('../controllers/medicineScheduleController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.use(authenticate);

// Patient routes
router.get('/my', authorize(ROLES.PATIENT), medicineScheduleController.getMySchedules);
router.get('/reminders/today', authorize(ROLES.PATIENT), medicineScheduleController.getTodayReminders);
router.get('/adherence', authorize(ROLES.PATIENT), medicineScheduleController.getAdherenceStats);
router.patch('/reminders/:logId/taken', authorize(ROLES.PATIENT), mongoIdParam('logId'), validate, medicineScheduleController.confirmTaken);
router.patch('/reminders/:logId/snooze', authorize(ROLES.PATIENT), mongoIdParam('logId'), validate, medicineScheduleController.snoozeReminder);
router.patch('/reminders/:logId/skip', authorize(ROLES.PATIENT), mongoIdParam('logId'), validate, medicineScheduleController.skipReminder);
router.patch('/:scheduleId/refill', authorize(ROLES.PATIENT), mongoIdParam('scheduleId'), validate, medicineScheduleController.configureRefillReminder);

// Doctor routes
router.post('/', authorize(ROLES.DOCTOR), medicineScheduleController.createSchedule);
router.get('/patient/:patientId', authorize(ROLES.DOCTOR), mongoIdParam('patientId'), validate, medicineScheduleController.getDoctorPatientSchedules);
router.get('/adherence/patient/:patientId', authorize(ROLES.DOCTOR), mongoIdParam('patientId'), validate, medicineScheduleController.getDoctorPatientAdherence);
router.patch('/:id', authorize(ROLES.DOCTOR), mongoIdParam('id'), validate, medicineScheduleController.updateSchedule);

module.exports = router;
