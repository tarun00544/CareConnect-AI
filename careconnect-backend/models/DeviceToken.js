const mongoose = require('mongoose');
const { DEVICE_PLATFORMS } = require('../config/constants');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    platform: {
      type: String,
      enum: Object.values(DEVICE_PLATFORMS),
      default: DEVICE_PLATFORMS.ANDROID,
    },
    deviceModel: { type: String, trim: true },
    appVersion: { type: String, trim: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

deviceTokenSchema.index({ userId: 1, platform: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
