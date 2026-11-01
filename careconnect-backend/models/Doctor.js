const mongoose = require('mongoose');
const { CONSULTATION_MODES, DOCUMENT_TYPES, VERIFICATION_STATUS } = require('../config/constants');

const availabilitySlotSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sunday
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "09:00"
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "13:00"
    slotDurationMinutes: { type: Number, default: 20, min: 5, max: 240 },
    // Optional break inside the window (no slots are generated during it)
    breakStartTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    breakEndTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

// Professional documents live in PRIVATE storage (never under /uploads) and are
// streamed through an authenticated route. `storageKey` is never serialised.
const documentSchema = new mongoose.Schema({
  type: { type: String, enum: Object.values(DOCUMENT_TYPES), required: true },
  title: { type: String, trim: true, maxlength: 120 },
  originalName: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String },
  size: { type: Number },
  storageKey: { type: String, required: true, select: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

// Sensitive sub-documents use `select: false`, so they are NOT returned by any
// existing `.populate('doctorId')` in the app (appointments, prescriptions, chat …).
// Admin code opts in explicitly with .select('+documents +registration …').
const doctorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    qualification: { type: String, trim: true },
    specialization: { type: String, trim: true, index: true }, // PRIMARY specialization
    experience: { type: Number, default: 0, min: 0, max: 80 },
    consultationFee: { type: Number, required: true, min: 0 },
    bio: { type: String, trim: true, maxlength: 2000 },
    availability: [availabilitySlotSchema],
    status: { type: String, enum: ['ACTIVE', 'ON_LEAVE', 'INACTIVE'], default: 'ACTIVE' },

    // --- personal (minimal) ---
    profilePhotoUrl: { type: String, trim: true },
    dateOfBirth: { type: Date, select: false },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
    address: {
      type: new mongoose.Schema({ line1: String, city: String, state: String, pincode: String }, { _id: false }),
      select: false,
    },

    // --- professional ---
    professionalCategory: { type: String, trim: true }, // validated against config/specializations.js
    additionalSpecializations: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    registration: {
      number: { type: String, trim: true, select: false },
      council: { type: String, trim: true, select: false },
      state: { type: String, trim: true, select: false },
    },
    // Verification is a RECORDED DECISION made through its own endpoint; it can never
    // be set by the create/update payloads.
    verification: {
      status: { type: String, enum: Object.values(VERIFICATION_STATUS), default: VERIFICATION_STATUS.PENDING },
      notes: { type: String, trim: true, maxlength: 1000, select: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
      verifiedAt: { type: Date },
      method: { type: String, enum: ['MANUAL_DOCUMENT_REVIEW', 'MIGRATION'], select: false },
    },
    documents: { type: [documentSchema], select: false },

    // --- hospital / consultation ---
    consultationRoom: { type: String, trim: true, maxlength: 60 },
    // Legacy doctors have no stored modes, so the default keeps them bookable as before.
    consultationModes: {
      type: [{ type: String, enum: Object.values(CONSULTATION_MODES) }],
      default: ['IN_PERSON', 'VIDEO', 'CHAT'],
    },
    appointmentDurationMinutes: { type: Number, default: 20, min: 5, max: 240 },
    followUpFee: { type: Number, min: 0 },
    emergencyAvailable: { type: Boolean, default: false },
    onlineConsultationAvailable: { type: Boolean, default: true },

    // --- schedule extras ---
    bookingEnabled: { type: Boolean, default: true },
    maxAppointmentsPerDay: { type: Number, min: 1, max: 500 },
    leaveDates: [{ type: String, match: /^\d{4}-\d{2}-\d{2}$/ }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

doctorSchema.index({ hospitalId: 1, departmentId: 1, status: 1 });
// A registration number is unique per (council, state) — only enforced when one is stored.
doctorSchema.index(
  { 'registration.council': 1, 'registration.state': 1, 'registration.number': 1 },
  { unique: true, partialFilterExpression: { 'registration.number': { $type: 'string' } } }
);

module.exports = mongoose.model('Doctor', doctorSchema);
