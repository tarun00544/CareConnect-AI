const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorize(ROLES.DOCTOR), prescriptionController.createPrescription);
router.get('/:id', mongoIdParam(), validate, prescriptionController.getPrescription);

module.exports = router;
