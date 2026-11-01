const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/constants');

router.get('/', pharmacyController.listMedicines);
router.get('/:id', mongoIdParam(), validate, pharmacyController.getMedicine);
router.post('/', authenticate, authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), pharmacyController.createMedicine);
router.patch('/:id', authenticate, authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), mongoIdParam(), validate, pharmacyController.updateMedicine);
router.delete('/:id', authenticate, authorize(ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN), mongoIdParam(), validate, pharmacyController.deleteMedicine);

module.exports = router;
