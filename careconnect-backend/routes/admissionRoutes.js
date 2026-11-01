const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/admissionController');
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { uploadAdmissionDoc } = require('../middleware/upload');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN), admissionController.createAdmission);
router.get('/:id', mongoIdParam(), validate, admissionController.getAdmission);
router.patch('/:id/status', authorize(ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN), mongoIdParam(), validate, admissionController.updateStatus);
router.post(
  '/:admissionId/documents',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN),
  uploadAdmissionDoc.single('document'),
  uploadController.uploadAdmissionDocument
);

module.exports = router;
