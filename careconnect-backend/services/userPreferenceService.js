const UserPreference = require('../models/UserPreference');

async function getPreferences(userId) {
  let pref = await UserPreference.findOne({ userId });
  if (!pref) {
    pref = await UserPreference.create({ userId });
  }
  return pref;
}

async function updatePreferences(userId, updateData) {
  // Enforce safety invariant: emergency alerts can never be disabled
  if (updateData.categories) {
    updateData.categories.emergency = true;
  }

  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true }
  );
  return pref;
}

function isQuietHours(pref, date = new Date()) {
  if (!pref?.quietHours?.enabled) return false;

  const start = pref.quietHours.start; // e.g. "22:00"
  const end = pref.quietHours.end; // e.g. "07:00"
  if (!start || !end) return false;

  // Format current time in user's timezone if Intl is available
  let hours, minutes;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: pref.timezone || 'Asia/Kolkata',
    });
    const parts = formatter.formatToParts(date);
    hours = parseInt(parts.find((p) => p.type === 'hour').value, 10);
    minutes = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  } catch {
    hours = date.getHours();
    minutes = date.getMinutes();
  }

  const currentMinutes = hours * 60 + minutes;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Crosses midnight, e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

module.exports = {
  getPreferences,
  updatePreferences,
  isQuietHours,
};
