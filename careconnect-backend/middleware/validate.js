const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after an express-validator chain array; collects errors into a
// single structured 400 response instead of letting bad input reach
// controllers/services.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  next();
}

module.exports = validate;
