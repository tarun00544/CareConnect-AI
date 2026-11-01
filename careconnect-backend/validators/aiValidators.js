const { body } = require('express-validator');

const assessmentValidator = [
  body('symptoms').isArray({ min: 1 }).withMessage('symptoms must be a non-empty array'),
  body('duration').optional().isString(),
  body('age').optional().isInt({ min: 0, max: 130 }),
  body('additionalInfo').optional().isString(),
];

const reportAnalysisValidator = [
  body('reportText').optional().isString(),
  body('fileUrl').optional().isString(),
  body('question').optional().isString(),
].filter(Boolean);

const consultationSummaryValidator = [
  body('appointmentId').isMongoId().withMessage('Valid appointmentId is required'),
];

module.exports = { assessmentValidator, reportAnalysisValidator, consultationSummaryValidator };
