const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Centralized error handler. Never leak stack traces or internal details
// to the client in production.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || undefined;

  // Multer (file upload) errors
  if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.uploads.maxMb} MB)` : 'Invalid file upload';
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already exists` : 'Duplicate resource';
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Rate limit / Quota exceeded errors
  if (statusCode === 429 && err.retryAfter) {
    res.setHeader('Retry-After', String(err.retryAfter));
  }

  if (!err.isOperational && statusCode === 500) {
    // Unexpected failures (database/driver errors, bugs): log in full, but never echo internals.
    message = 'Internal server error';
    details = undefined;
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
  } else {
    logger.warn('Handled error', { statusCode, message });
  }

  const body = {
    success: false,
    message,
    ...(details ? { details } : {}),
  };

  if (env.nodeEnv === 'development' && statusCode === 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
