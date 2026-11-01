const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const deviceTokenService = require('../services/deviceTokenService');

// POST /api/devices/register
const registerDevice = asyncHandler(async (req, res) => {
  const record = await deviceTokenService.registerToken({
    userId: req.user._id,
    token: req.body.token,
    platform: req.body.platform,
    deviceModel: req.body.deviceModel,
    appVersion: req.body.appVersion,
  });
  new ApiResponse(201, record, 'Device registered successfully for push notifications').send(res);
});

// PUT /api/devices/token
const refreshDeviceToken = asyncHandler(async (req, res) => {
  const updated = await deviceTokenService.refreshToken({
    userId: req.user._id,
    oldToken: req.body.oldToken,
    newToken: req.body.newToken,
  });
  new ApiResponse(200, updated, 'Device token refreshed successfully').send(res);
});

// DELETE /api/devices/:token
const removeDevice = asyncHandler(async (req, res) => {
  const token = req.params.token || req.body.token;
  await deviceTokenService.removeToken({ userId: req.user._id, token });
  new ApiResponse(200, null, 'Device token removed successfully').send(res);
});

// GET /api/devices
const getMyDevices = asyncHandler(async (req, res) => {
  const devices = await deviceTokenService.getUserTokens(req.user._id);
  new ApiResponse(200, devices).send(res);
});

module.exports = {
  registerDevice,
  refreshDeviceToken,
  removeDevice,
  getMyDevices,
};
