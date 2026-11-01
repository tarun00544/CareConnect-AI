const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { VERIFICATION_STATUS } = require('../config/constants');

const ACTIVE_APPT = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULED'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// DOCTOR_VERIFICATION_POLICY=required (default) → only VERIFIED doctors are bookable / listed.
// DOCTOR_VERIFICATION_POLICY=optional → verification is informational (useful for demos).
const verificationRequired = () => (process.env.DOCTOR_VERIFICATION_POLICY || 'required').toLowerCase() !== 'optional';

/** Mongo filter for doctors that may appear in the public directory / be booked. */
function bookableFilter() {
  const f = { status: 'ACTIVE', bookingEnabled: { $ne: false } };
  if (verificationRequired()) f['verification.status'] = VERIFICATION_STATUS.VERIFIED;
  return f;
}

/** Why a (loaded) doctor cannot take new bookings, or null if they can. */
function bookingBlockReason(doctor) {
  if (!doctor || doctor.status !== 'ACTIVE') return 'Doctor is not available for booking';
  if (doctor.bookingEnabled === false) return 'Online booking is currently disabled for this doctor';
  if (verificationRequired() && doctor.verification?.status !== VERIFICATION_STATUS.VERIFIED) {
    return 'Doctor is awaiting professional verification';
  }
  return null;
}

/**
 * Validates a doctor's schedule payload (array of windows). Returns an array of
 * human-readable problems (empty when valid). Shared by admin + doctor endpoints.
 */
function validateAvailability(rows) {
  const errs = [];
  if (!Array.isArray(rows)) return ['availability must be an array'];
  if (rows.length > 42) errs.push('Too many schedule windows');
  rows.forEach((r, i) => {
    const label = `Window ${i + 1}`;
    if (!Number.isInteger(r.dayOfWeek) || r.dayOfWeek < 0 || r.dayOfWeek > 6) return errs.push(`${label}: invalid day`);
    if (!TIME_RE.test(r.startTime || '') || !TIME_RE.test(r.endTime || '')) return errs.push(`${label}: times must be HH:mm`);
    if (toMin(r.endTime) <= toMin(r.startTime)) return errs.push(`${label}: end time must be after start time`);
    const dur = r.slotDurationMinutes === undefined ? 20 : Number(r.slotDurationMinutes);
    if (!(dur >= 5 && dur <= 240)) return errs.push(`${label}: slot duration must be 5–240 minutes`);
    if (toMin(r.endTime) - toMin(r.startTime) < dur) errs.push(`${label}: window is shorter than one slot`);
    const hasBs = r.breakStartTime !== undefined && r.breakStartTime !== null && r.breakStartTime !== '';
    const hasBe = r.breakEndTime !== undefined && r.breakEndTime !== null && r.breakEndTime !== '';
    if (hasBs !== hasBe) errs.push(`${label}: set both break start and break end, or neither`);
    else if (hasBs) {
      if (!TIME_RE.test(r.breakStartTime) || !TIME_RE.test(r.breakEndTime)) errs.push(`${label}: break times must be HH:mm`);
      else if (toMin(r.breakEndTime) <= toMin(r.breakStartTime)) errs.push(`${label}: break end must be after break start`);
      else if (toMin(r.breakStartTime) < toMin(r.startTime) || toMin(r.breakEndTime) > toMin(r.endTime)) errs.push(`${label}: break must fall inside the window`);
    }
  });
  for (let d = 0; d < 7; d += 1) {
    const day = rows.filter((r) => r.dayOfWeek === d && TIME_RE.test(r.startTime || '') && TIME_RE.test(r.endTime || '')).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    for (let i = 1; i < day.length; i += 1) {
      if (toMin(day[i].startTime) < toMin(day[i - 1].endTime)) errs.push('Schedule windows on the same day overlap');
    }
  }
  return [...new Set(errs)];
}

/** Strips a schedule payload down to the persisted fields. */
function cleanAvailability(rows, defaultDuration = 20) {
  return rows.map((r) => {
    const out = {
      dayOfWeek: Number(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
      slotDurationMinutes: Number(r.slotDurationMinutes || defaultDuration),
    };
    if (r.breakStartTime && r.breakEndTime) {
      out.breakStartTime = r.breakStartTime;
      out.breakEndTime = r.breakEndTime;
    }
    return out;
  });
}

const parseDateOnly = (dateStr) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) throw ApiError.badRequest('date must be YYYY-MM-DD');
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid date');
  return d;
};

/** All grid slots a doctor offers on a date (ignores existing bookings). */
function templateSlots(doctor, dateObj) {
  const dateStr = dateObj.toISOString().slice(0, 10);
  if ((doctor.leaveDates || []).includes(dateStr)) return [];
  const dow = dateObj.getUTCDay();
  const slots = [];
  for (const w of doctor.availability.filter((a) => a.dayOfWeek === dow)) {
    const dur = w.slotDurationMinutes || 20;
    const bs = w.breakStartTime ? toMin(w.breakStartTime) : null;
    const be = w.breakEndTime ? toMin(w.breakEndTime) : null;
    for (let cur = toMin(w.startTime); cur + dur <= toMin(w.endTime); cur += dur) {
      const end = cur + dur;
      if (bs !== null && be !== null && cur < be && end > bs) continue; // overlaps the break
      slots.push({ startTime: fromMin(cur), endTime: fromMin(end) });
    }
  }
  return slots;
}

/** Slots for a date with `available` flags (booked / max-per-day applied). */
async function slotsForDate(doctor, dateStr) {
  const dateObj = parseDateOnly(dateStr);
  const blockReason = bookingBlockReason(doctor);
  if (blockReason) return { date: dateStr, slots: [], bookable: false, reason: blockReason };

  const booked = await Appointment.find({ doctorId: doctor._id, date: dateObj, status: { $in: ACTIVE_APPT } }).select('startTime');
  const bookedTimes = new Set(booked.map((a) => a.startTime));
  const dayFull = doctor.maxAppointmentsPerDay && booked.length >= doctor.maxAppointmentsPerDay;
  const slots = templateSlots(doctor, dateObj).map((s) => ({ ...s, available: !dayFull && !bookedTimes.has(s.startTime) }));
  return { date: dateStr, slots, bookable: true };
}

/**
 * Backend enforcement for create/reschedule: the requested slot must exist on the doctor's grid
 * (so clients cannot invent times), the day must not be past/leave/full, and the end time is
 * derived server-side. Returns the canonical { date, startTime, endTime }.
 */
async function assertSlotBookable(doctor, { date, startTime }, { ignoreAppointmentId } = {}) {
  const reason = bookingBlockReason(doctor);
  if (reason) throw ApiError.badRequest(reason);

  const dateObj = parseDateOnly(date);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  if (dateObj < today) throw ApiError.badRequest('Appointments cannot be booked in the past');

  const slot = templateSlots(doctor, dateObj).find((s) => s.startTime === startTime);
  if (!slot) throw ApiError.badRequest('The selected time is not within this doctor\'s available schedule');

  if (doctor.maxAppointmentsPerDay) {
    const q = { doctorId: doctor._id, date: dateObj, status: { $in: ACTIVE_APPT } };
    if (ignoreAppointmentId) q._id = { $ne: ignoreAppointmentId };
    const count = await Appointment.countDocuments(q);
    if (count >= doctor.maxAppointmentsPerDay) throw ApiError.conflict('This doctor has no remaining appointments on the selected day');
  }
  return { date: dateObj, startTime: slot.startTime, endTime: slot.endTime };
}

module.exports = {
  ACTIVE_APPT,
  TIME_RE,
  toMin,
  verificationRequired,
  bookableFilter,
  bookingBlockReason,
  validateAvailability,
  cleanAvailability,
  slotsForDate,
  assertSlotBookable,
};
