const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { mongoIdParam } = require('../validators/commonValidators');
const validate = require('../middleware/validate');
const { createOrderValidator, verifyPaymentValidator } = require('../validators/paymentValidators');

router.use(authenticate);

router.post('/create-order', createOrderValidator, validate, paymentController.createOrder);
router.post('/verify', verifyPaymentValidator, validate, paymentController.verify);
router.get('/my', paymentController.getMyPayments);
router.get('/:id', mongoIdParam(), validate, paymentController.getPayment);

module.exports = router;
