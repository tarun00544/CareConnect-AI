const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  new ApiResponse(201, result, 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  new ApiResponse(200, result, 'Login successful').send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  new ApiResponse(200, result, 'Token refreshed').send(res);
});

const me = asyncHandler(async (req, res) => {
  new ApiResponse(200, authService.sanitizeUser(req.user), 'Current user').send(res);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  new ApiResponse(200, null, 'Logged out successfully').send(res);
});

const getInvitation = asyncHandler(async (req, res) => {
  new ApiResponse(200, await authService.getInvitation(req.params.token), 'Invitation').send(res);
});

const acceptInvitation = asyncHandler(async (req, res) => {
  const result = await authService.acceptInvitation(req.body || {});
  new ApiResponse(200, result, 'Account activated. You can now sign in.').send(res);
});

module.exports = { register, login, refresh, me, logout, getInvitation, acceptInvitation };
