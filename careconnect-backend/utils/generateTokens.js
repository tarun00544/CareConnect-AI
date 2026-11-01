const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
