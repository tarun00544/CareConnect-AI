const DeviceToken = require('../models/DeviceToken');

async function registerToken({ userId, token, platform = 'ANDROID', deviceModel = '', appVersion = '' }) {
  if (!token) throw new Error('Device token is required');

  const record = await DeviceToken.findOneAndUpdate(
    { token },
    {
      userId,
      platform,
      deviceModel,
      appVersion,
      lastActiveAt: new Date(),
    },
    { upsert: true, new: true }
  );
  return record;
}

async function refreshToken({ oldToken, newToken, userId }) {
  if (!oldToken || !newToken) throw new Error('Both oldToken and newToken are required');

  const updated = await DeviceToken.findOneAndUpdate(
    { token: oldToken, userId },
    { token: newToken, lastActiveAt: new Date() },
    { new: true }
  );
  return updated;
}

async function removeToken({ userId, token }) {
  if (!token) throw new Error('Device token is required');
  const result = await DeviceToken.findOneAndDelete({ userId, token });
  return result;
}

async function removeAllUserTokens(userId) {
  const result = await DeviceToken.deleteMany({ userId });
  return result;
}

async function getUserTokens(userId) {
  return DeviceToken.find({ userId }).select('token platform deviceModel appVersion');
}

/**
 * Android Notification Contract Builder
 * Generates Android FCM-compliant data payloads conforming to Android O+ Notification Channels
 * and HIPAA-aligned lock-screen privacy masking.
 */
function buildFcmPayload({ notification, preference, isEmergency = false }) {
  const channelMap = {
    MEDICINE_REMINDER: 'channel_medicine_reminders',
    REFILL_REMINDER: 'channel_refills',
    APPOINTMENT_REMINDER: 'channel_appointments',
    APPOINTMENT_REQUESTED: 'channel_appointments',
    APPOINTMENT_CONFIRMED: 'channel_appointments',
    APPOINTMENT_CANCELLED: 'channel_appointments',
    APPOINTMENT_RESCHEDULED: 'channel_appointments',
    EMERGENCY_UPDATE: 'channel_emergency',
  };

  const channelId = isEmergency
    ? 'channel_emergency'
    : channelMap[notification.type] || 'channel_general';

  const maskLockScreen = preference?.privacy?.maskLockScreenDetails ?? true;

  // Generic lock screen text vs authenticated private text
  let publicTitle = notification.title;
  let publicBody = notification.message;

  if (maskLockScreen && notification.type === 'MEDICINE_REMINDER') {
    publicTitle = 'Medication Reminder';
    publicBody = 'Time for your scheduled medicine';
  }

  return {
    data: {
      notificationId: String(notification._id || ''),
      occurrenceId: String(notification.metadata?.occurrenceId || ''),
      type: notification.type,
      channelId,
      title: publicTitle,
      body: publicBody,
      privateTitle: notification.title,
      privateBody: notification.message,
      isPrivate: maskLockScreen ? 'true' : 'false',
      priority: isEmergency ? 'high' : 'normal',
      sound: preference?.reminderSound || 'chime',
      vibration: preference?.vibration !== false ? 'true' : 'false',
      metadata: JSON.stringify(notification.metadata || {}),
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: isEmergency ? 'high' : 'normal',
      notification: {
        channelId,
        visibility: maskLockScreen ? 'private' : 'public',
        sound: preference?.reminderSound || 'default',
        defaultVibrateTimings: preference?.vibration !== false,
      },
    },
  };
}

module.exports = {
  registerToken,
  refreshToken,
  removeToken,
  removeAllUserTokens,
  getUserTokens,
  buildFcmPayload,
};
