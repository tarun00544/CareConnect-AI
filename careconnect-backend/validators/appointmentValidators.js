const { body, param } = require('express-validator');

const createAppointmentValidator = [
  body('doctorId').isMongoId().withMessage('Valid doctorId is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:mm'),
  body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:mm'),
  body('consultationType').optional().isIn(['IN_PERSON', 'VIDEO', 'AUDIO', 'CHAT']),
  body('notes').optional().isString().trim(),
];

const rescheduleValidator = [
  param('id').isMongoId(),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:mm'),
  body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:mm'),
];

const statusValidator = [
  param('id').isMongoId(),
  body('status')
    .isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .withMessage('Invalid status'),
];

module.exports = { createAppointmentValidator, rescheduleValidator, statusValidator };
