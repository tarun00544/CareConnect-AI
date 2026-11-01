const { body } = require('express-validator');

const createOrderValidator = [
  body('type').isIn(['APPOINTMENT', 'ORDER']).withMessage('type must be APPOINTMENT or ORDER'),
  body('referenceId').isMongoId().withMessage('Valid referenceId is required'),
];

const verifyPaymentValidator = [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
];

module.exports = { createOrderValidator, verifyPaymentValidator };
