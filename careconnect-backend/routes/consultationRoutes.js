const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const { authenticate } = require('../middleware/auth');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');

router.use(authenticate);

router.post('/', consultationController.startConsultation);
router.get('/:id', mongoIdParam(), validate, consultationController.getConsultation);
router.patch('/:id', mongoIdParam(), validate, consultationController.updateConsultation);
router.post('/:id/notes', mongoIdParam(), validate, consultationController.addNotes);

module.exports = router;
