const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Patient = require('../models/Patient');
const ApiError = require('../utils/ApiError');
const { ROLES, USER_STATUS } = require('../config/constants');
const { hashToken } = require('./doctorAdminService');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/generateTokens');

const SALT_ROUNDS = 12;

async function register({ name, email, password, phone, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Public self-registration creates PATIENT accounts only. Doctors are onboarded by a hospital
  // admin (invitation + verification workflow) and staff/admin accounts by a SUPER_ADMIN, so a
  // client can no longer self-assign the DOCTOR role.
  void role;
  const finalRole = ROLES.PATIENT;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, phone, role: finalRole });

  if (finalRole === ROLES.PATIENT) {
    await Patient.create({ userId: user._id });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw ApiError.unauthorized('Invalid email or password');

  // Status is checked AFTER the password so account states are not revealed to someone guessing.
  if (user.status === USER_STATUS.PENDING_VERIFICATION) {
    throw ApiError.forbidden('Your account invitation has not been accepted yet. Use the invitation link you were given.');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Account is not active. Contact support.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

// Invitation workflow (doctor onboarding): the invitee proves possession of the one-time token
// and sets their own password. Only a hash of the token is stored; it is single-use and expires.
async function getInvitation(token) {
  const user = await findInvitee(token);
  return { name: user.name, email: user.email, expiresAt: user.inviteExpiresAt };
}

async function findInvitee(token) {
  if (!token || typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
    throw ApiError.badRequest('This invitation link is not valid');
  }
  const user = await User.findOne({ inviteTokenHash: hashToken(token) }).select('+inviteTokenHash +inviteExpiresAt');
  if (!user || user.status !== USER_STATUS.PENDING_VERIFICATION || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    throw ApiError.badRequest('This invitation link is invalid or has expired. Ask your hospital administrator for a new one.');
  }
  return user;
}

async function acceptInvitation({ token, password }) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw ApiError.badRequest('Validation failed', [{ field: 'password', message: 'Password must be 8–128 characters' }]);
  }
  const user = await findInvitee(token);
  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.status = USER_STATUS.ACTIVE;
  user.emailVerified = true; // possession of the emailed/shared link proves control of the address
  user.inviteTokenHash = undefined;
  user.inviteExpiresAt = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return { email: user.email };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account not found or inactive');
  }

  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(userId) {
  // Invalidate all outstanding refresh tokens by bumping tokenVersion.
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
  };
}

module.exports = { register, login, refresh, logout, sanitizeUser, getInvitation, acceptInvitation };
