const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/generateTokens');
const User = require('../models/User');

// Verifies the JWT access token and attaches the authenticated user to
// req.user. Every downstream ownership/role check depends on this running
// first — never trust role/identity claims from the request body.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub).select('-passwordHash');
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account not found or inactive');
  }

  req.user = user;
  next();
});

// Optional auth: attaches req.user if a valid token is present, but does
// not reject the request when absent. Useful for public-ish endpoints.
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (user && user.status === 'ACTIVE') req.user = user;
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
});

module.exports = { authenticate, optionalAuthenticate };
