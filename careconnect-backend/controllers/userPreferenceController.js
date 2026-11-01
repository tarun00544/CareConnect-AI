const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const userPreferenceService = require('../services/userPreferenceService');

// GET /api/preferences
const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await userPreferenceService.getPreferences(req.user._id);
  new ApiResponse(200, preferences).send(res);
});

// PUT /api/preferences
const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await userPreferenceService.updatePreferences(req.user._id, req.body);
  new ApiResponse(200, preferences, 'Preferences updated successfully').send(res);
});

module.exports = {
  getPreferences,
  updatePreferences,
};
