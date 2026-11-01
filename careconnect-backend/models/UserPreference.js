const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    reminderSound: {
      type: String,
      enum: ['chime', 'gentle', 'pulse', 'bell', 'default'],
      default: 'chime',
    },
    vibration: { type: Boolean, default: true },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '07:00' },
    },
    categories: {
      medicine: { type: Boolean, default: true },
      appointments: { type: Boolean, default: true },
      refills: { type: Boolean, default: true },
      updates: { type: Boolean, default: true },
      emergency: { type: Boolean, default: true, immutable: true }, // Cannot be disabled (safety invariant)
    },
    defaultSnoozeMinutes: {
      type: Number,
      enum: [5, 10, 15, 30, 60],
      default: 15,
    },
    privacy: {
      maskLockScreenDetails: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
