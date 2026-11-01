const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorize(ROLES.PATIENT), emergencyController.createEmergency);
router.get('/:id', mongoIdParam(), validate, emergencyController.getEmergency);
router.patch('/:id/status', authorize(ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.SUPER_ADMIN), mongoIdParam(), validate, emergencyController.updateStatus);

module.exports = router;
