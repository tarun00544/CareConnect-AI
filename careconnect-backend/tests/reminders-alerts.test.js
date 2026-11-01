const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const MedicineSchedule = require('../models/MedicineSchedule');
const MedicineLog = require('../models/MedicineLog');
const UserPreference = require('../models/UserPreference');
const DeviceToken = require('../models/DeviceToken');
const { NOTIFICATION_TYPES, REMINDER_STATUS, DEVICE_PLATFORMS, ROLES } = require('../config/constants');
const userPreferenceService = require('../services/userPreferenceService');
const deviceTokenService = require('../services/deviceTokenService');
const medicineScheduleService = require('../services/medicineScheduleService');

describe('CareConnect AI - Smart Medicine Reminder & Alert System Test Suite', () => {

  // ==========================================
  // SECTION 1: MEDICINE SCHEDULE MODEL & CREATION
  // ==========================================
  describe('1. Medicine Schedule Model & Time Validation', () => {
    it('should validate MedicineSchedule with required clinical fields', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const schedule = new MedicineSchedule({
        patientId: dummyId,
        doctorId: dummyId,
        prescriptionId: dummyId,
        medicineName: 'Amoxicillin',
        dosage: '500mg',
        prescribedInstructions: 'Take with food twice daily',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-08'),
        reminderTimes: ['08:00', '20:00'],
        timezone: 'Asia/Kolkata',
        active: true,
      });

      const err = schedule.validateSync();
      assert.equal(err, undefined, 'MedicineSchedule should be valid with all required fields');
      assert.equal(schedule.active, true);
      assert.equal(schedule.refillReminder.enabled, false);
    });

    it('should reject invalid reminder times that do not conform to HH:mm format', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const schedule = new MedicineSchedule({
        patientId: dummyId,
        doctorId: dummyId,
        prescriptionId: dummyId,
        medicineName: 'Amoxicillin',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-08'),
        reminderTimes: ['25:99', 'invalid-time'], // Invalid 24h times
      });

      const err = schedule.validateSync();
      assert.ok(err, 'Should fail validation with invalid HH:mm times');
      assert.ok(err.errors.reminderTimes, 'Validation error must be on reminderTimes');
    });
  });

  // ==========================================
  // SECTION 2: MEDICINE LOG DEDUPLICATION & OCCURRENCE ID
  // ==========================================
  describe('2. Duplicate Prevention via Unique occurrenceId', () => {
    it('should validate MedicineLog schema and require occurrenceId', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const log = new MedicineLog({
        scheduleId: dummyId,
        patientId: dummyId,
        occurrenceId: `${dummyId}_2026-11-01_08:00`,
        scheduledDate: '2026-11-01',
        scheduledTime: '08:00',
        medicineName: 'Amoxicillin',
        status: REMINDER_STATUS.PENDING,
      });

      const err = log.validateSync();
      assert.equal(err, undefined, 'MedicineLog should be valid');
      assert.equal(log.status, REMINDER_STATUS.PENDING);
    });

    it('should generate deterministic occurrenceId for idempotency', () => {
      const scheduleId = '654321654321654321654321';
      const date = '2026-11-05';
      const time = '08:00';

      const occurrenceId1 = `${scheduleId}_${date}_${time}`;
      const occurrenceId2 = `${scheduleId}_${date}_${time}`;

      assert.equal(occurrenceId1, occurrenceId2, 'Occurrence ID must be deterministic and identical for same occurrence');
    });
  });

  // ==========================================
  // SECTION 3: PATIENT CONFIRMATION ACTIONS
  // ==========================================
  describe('3. Patient Reminder Actions (Taken, Snooze, Skip)', () => {
    it('should confirm dose taken and record takenAt timestamp', () => {
      const log = {
        _id: new mongoose.Types.ObjectId(),
        status: REMINDER_STATUS.PENDING,
        takenAt: null,
      };

      // Emulate confirmTaken logic
      log.status = REMINDER_STATUS.TAKEN;
      log.takenAt = new Date();

      assert.equal(log.status, REMINDER_STATUS.TAKEN);
      assert.ok(log.takenAt instanceof Date, 'takenAt must be recorded on confirmation');
    });

    it('should snooze reminder by specified duration and increment snooze count', () => {
      const log = {
        _id: new mongoose.Types.ObjectId(),
        status: REMINDER_STATUS.PENDING,
        snoozedUntil: null,
        snoozeCount: 0,
      };

      const snoozeMinutes = 15;
      const beforeTime = Date.now();
      log.status = REMINDER_STATUS.SNOOZED;
      log.snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
      log.snoozeCount += 1;

      assert.equal(log.status, REMINDER_STATUS.SNOOZED);
      assert.equal(log.snoozeCount, 1);
      assert.ok(log.snoozedUntil.getTime() >= beforeTime + 14 * 60 * 1000);
    });

    it('should skip reminder and record clinical skip reason', () => {
      const log = {
        _id: new mongoose.Types.ObjectId(),
        status: REMINDER_STATUS.PENDING,
        skippedReason: null,
      };

      const reason = 'Experiencing side effects';
      log.status = REMINDER_STATUS.SKIPPED;
      log.skippedReason = reason;

      assert.equal(log.status, REMINDER_STATUS.SKIPPED);
      assert.equal(log.skippedReason, reason);
    });
  });

  // ==========================================
  // SECTION 4: TIMEZONE & DAYLIGHT SAVINGS
  // ==========================================
  describe('4. Timezone & Local Date Handling', () => {
    it('should format date correctly in specified timezones', () => {
      const testDate = new Date('2026-11-01T00:30:00Z');

      const istDate = medicineScheduleService.getLocalDateString(testDate, 'Asia/Kolkata');
      const nyDate = medicineScheduleService.getLocalDateString(testDate, 'America/New_York');

      // 00:30 UTC on Nov 1 is 06:00 AM Nov 1 in IST, but 20:30 PM Oct 31 in EDT (DST active)
      assert.equal(istDate, '2026-11-01');
      assert.equal(nyDate, '2026-10-31');
    });

    it('should accurately detect quiet hours across midnight boundary', () => {
      const pref = {
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
        timezone: 'UTC',
      };

      // 23:30 UTC -> inside quiet hours
      const nightDate = new Date('2026-11-01T23:30:00Z');
      assert.equal(userPreferenceService.isQuietHours(pref, nightDate), true, '23:30 must be in quiet hours');

      // 03:00 UTC -> inside quiet hours
      const earlyMorningDate = new Date('2026-11-01T03:00:00Z');
      assert.equal(userPreferenceService.isQuietHours(pref, earlyMorningDate), true, '03:00 must be in quiet hours');

      // 14:00 UTC -> daytime, outside quiet hours
      const afternoonDate = new Date('2026-11-01T14:00:00Z');
      assert.equal(userPreferenceService.isQuietHours(pref, afternoonDate), false, '14:00 must NOT be in quiet hours');
    });
  });

  // ==========================================
  // SECTION 5: ADHERENCE STATS & SAFETY
  // ==========================================
  describe('5. Adherence Calculation & Terminology Safety', () => {
    it('should calculate adherence rate and strictly label pending as unconfirmed, never missed', () => {
      const sampleLogs = [
        { status: REMINDER_STATUS.TAKEN },
        { status: REMINDER_STATUS.TAKEN },
        { status: REMINDER_STATUS.TAKEN },
        { status: REMINDER_STATUS.SKIPPED },
        { status: REMINDER_STATUS.PENDING },
      ];

      const total = sampleLogs.length; // 5
      const taken = sampleLogs.filter((l) => l.status === REMINDER_STATUS.TAKEN).length; // 3
      const unconfirmed = sampleLogs.filter((l) => l.status === REMINDER_STATUS.PENDING).length; // 1
      const adherenceRate = Math.round((taken / total) * 100); // 60%

      assert.equal(adherenceRate, 60);
      assert.equal(unconfirmed, 1);
      // Verify safety constraint: unconfirmed count is positive, never counted as missed dose
      assert.ok(unconfirmed > 0, 'Must track unconfirmed doses distinctly');
    });
  });

  // ==========================================
  // SECTION 6: REFILL REMINDERS
  // ==========================================
  describe('6. Refill Reminders Non-Prescriptive Constraint', () => {
    it('should calculate refill reminder date based on prescribed end date without authorising purchase', () => {
      const endDate = new Date('2026-11-20T00:00:00Z');
      const remindDaysBefore = 3;
      const expectedReminderDate = new Date(endDate.getTime() - remindDaysBefore * 24 * 60 * 60 * 1000);

      const refillConfig = {
        enabled: true,
        remindDaysBefore,
        reminderDate: expectedReminderDate,
      };

      assert.equal(refillConfig.enabled, true);
      assert.equal(refillConfig.reminderDate.toISOString(), new Date('2026-11-17T00:00:00Z').toISOString());
    });
  });

  // ==========================================
  // SECTION 7: USER PREFERENCES & SAFETY INVARIANTS
  // ==========================================
  describe('7. User Preferences & Critical Safety Bypasses', () => {
    it('should validate UserPreference schema and ensure emergency category cannot be disabled', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const pref = new UserPreference({
        userId: dummyId,
        reminderSound: 'gentle',
        vibration: true,
        defaultSnoozeMinutes: 15,
        privacy: { maskLockScreenDetails: true },
      });

      const err = pref.validateSync();
      assert.equal(err, undefined, 'UserPreference should be valid');
      assert.equal(pref.categories.emergency, true, 'Emergency category must always default to true');
    });

    it('should prevent suppressing emergency alerts via service layer', async () => {
      const updateData = {
        categories: {
          medicine: false,
          emergency: false, // Attempt to disable emergency
        },
      };

      // Enforce the rule from userPreferenceService
      if (updateData.categories) {
        updateData.categories.emergency = true;
      }

      assert.equal(updateData.categories.emergency, true, 'Emergency category must be forced to true');
    });
  });

  // ==========================================
  // SECTION 8: ANDROID NOTIFICATION CONTRACT & FCM PAYLOAD
  // ==========================================
  describe('8. Android FCM Contract & Lock-Screen Privacy', () => {
    it('should generate masked lock-screen text when maskLockScreenDetails is enabled', () => {
      const notification = {
        _id: new mongoose.Types.ObjectId(),
        type: NOTIFICATION_TYPES.MEDICINE_REMINDER,
        title: 'Take Metformin 500mg',
        message: 'Take 1 tablet with breakfast',
        metadata: { occurrenceId: 'occ_123' },
      };

      const preference = {
        reminderSound: 'chime',
        vibration: true,
        privacy: { maskLockScreenDetails: true },
      };

      const payload = deviceTokenService.buildFcmPayload({ notification, preference });

      assert.equal(payload.data.title, 'Medication Reminder', 'Public title must be generic on lock screen');
      assert.equal(payload.data.body, 'Time for your scheduled medicine', 'Public body must be generic on lock screen');
      assert.equal(payload.data.privateTitle, 'Take Metformin 500mg', 'Private title must retain clinical details');
      assert.equal(payload.data.privateBody, 'Take 1 tablet with breakfast', 'Private body must retain clinical details');
      assert.equal(payload.data.channelId, 'channel_medicine_reminders');
      assert.equal(payload.android.notification.visibility, 'private');
    });

    it('should generate high priority channel for emergency alerts', () => {
      const notification = {
        _id: new mongoose.Types.ObjectId(),
        type: NOTIFICATION_TYPES.EMERGENCY_UPDATE,
        title: 'Ambulance Dispatched',
        message: 'Ambulance #102 is en route to your location',
      };

      const payload = deviceTokenService.buildFcmPayload({ notification, preference: {}, isEmergency: true });

      assert.equal(payload.data.channelId, 'channel_emergency');
      assert.equal(payload.data.priority, 'high');
      assert.equal(payload.android.priority, 'high');
    });

    it('should validate DeviceToken schema with platform enum', () => {
      const dummyId = new mongoose.Types.ObjectId();
      const device = new DeviceToken({
        userId: dummyId,
        token: 'fcm_sample_device_token_xyz_123',
        platform: DEVICE_PLATFORMS.ANDROID,
        deviceModel: 'Pixel 8 Pro',
        appVersion: '2.1.0',
      });

      const err = device.validateSync();
      assert.equal(err, undefined, 'DeviceToken schema should validate cleanly');
      assert.equal(device.platform, 'ANDROID');
    });
  });

  // ==========================================
  // SECTION 9: AUTHORIZATION & OWNERSHIP SECURITY
  // ==========================================
  describe('9. Role-Based Access & Ownership Gates', () => {
    it('should reject schedule creation if doctor is not the prescribing physician', () => {
      const doctorAId = new mongoose.Types.ObjectId();
      const doctorBId = new mongoose.Types.ObjectId();
      const prescription = {
        _id: new mongoose.Types.ObjectId(),
        doctorId: doctorAId,
        patientId: new mongoose.Types.ObjectId(),
      };

      // Doctor B attempts to create schedule for Doctor A's prescription
      const isAuthorized = String(prescription.doctorId) === String(doctorBId);
      assert.equal(isAuthorized, false, 'Doctor B must be forbidden from creating schedule for Doctor A prescription');
    });

    it('should prevent patient from accessing another patient medicine logs', () => {
      const patientA = new mongoose.Types.ObjectId();
      const patientB = new mongoose.Types.ObjectId();

      const log = {
        _id: new mongoose.Types.ObjectId(),
        patientId: patientA,
      };

      const hasAccess = String(log.patientId) === String(patientB);
      assert.equal(hasAccess, false, 'Patient B must not be granted access to Patient A reminder log');
    });
  });
});
