const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Hospital = require('../models/Hospital');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { runInTransaction } = require('../utils/transaction');
const { escapeRegex } = require('../utils/regex');
const { PRIVATE_DOC_DIR } = require('../middleware/upload');
const scheduleService = require('./scheduleService');
const {
  ROLES, USER_STATUS, VERIFICATION_STATUS, CONSULTATION_MODES, DOCUMENT_TYPES,
} = require('../config/constants');
const { getCategory, getSpecialization, LANGUAGES } = require('../config/specializations');

const SALT_ROUNDS = 12;
const INVITE_TTL_HOURS = 72;
const MAX_DOCS = 10;

// Fields hidden by default on Doctor (select:false) that admin screens need.
const SENSITIVE = '+documents +documents.storageKey +registration.number +registration.council +registration.state +verification.notes +verification.verifiedBy +verification.method +dateOfBirth +address';

/* ------------------------------------------------------------------ authorization */

/** The hospital an actor may act on. HOSPITAL_ADMIN: always their own — a payload cannot override it. */
function resolveHospitalId(actor, bodyHospitalId) {
  if (actor.role === ROLES.HOSPITAL_ADMIN) {
    if (!actor.hospitalId) throw ApiError.forbidden('Your account is not assigned to a hospital');
    if (bodyHospitalId && String(bodyHospitalId) !== String(actor.hospitalId)) {
      throw ApiError.forbidden('You can only manage doctors of your own hospital');
    }
    return actor.hospitalId;
  }
  if (actor.role === ROLES.SUPER_ADMIN) {
    if (!bodyHospitalId || !mongoose.isValidObjectId(bodyHospitalId)) {
      throw ApiError.badRequest('Validation failed', [{ field: 'hospitalId', message: 'hospitalId is required for super admins' }]);
    }
    return bodyHospitalId;
  }
  throw ApiError.forbidden('You do not have permission to perform this action');
}

function assertHospitalAccess(actor, hospitalId) {
  if (actor.role === ROLES.SUPER_ADMIN) return;
  if (actor.role === ROLES.HOSPITAL_ADMIN && actor.hospitalId && String(actor.hospitalId) === String(hospitalId)) return;
  throw ApiError.forbidden('You do not have access to this doctor');
}

/** Hospital filter for list queries; a HOSPITAL_ADMIN without a hospital sees nothing. */
function listScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  if (actor.role === ROLES.HOSPITAL_ADMIN && actor.hospitalId) return { hospitalId: actor.hospitalId };
  throw ApiError.forbidden('Your account is not assigned to a hospital');
}

async function loadDoctor(actor, id, { sensitive = true } = {}) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid doctor id');
  let q = Doctor.findById(id);
  if (sensitive) q = q.select(SENSITIVE);
  const doctor = await q;
  if (!doctor) throw ApiError.notFound('Doctor not found');
  assertHospitalAccess(actor, doctor.hospitalId); // ownership check BEFORE anything is read or changed
  return doctor;
}

/* ------------------------------------------------------------------ validation */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,16}$/;
const PIN_RE = /^\d{6}$/;
const REG_NO_RE = /^[A-Za-z0-9][A-Za-z0-9/\-\s.]{2,39}$/;
const PHOTO_RE = /^\/uploads\/profiles\/[A-Za-z0-9._-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ONLINE_MODES = [CONSULTATION_MODES.VIDEO, CONSULTATION_MODES.AUDIO, CONSULTATION_MODES.CHAT];

const str = (v) => (typeof v === 'string' ? v.trim() : v);
const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

/**
 * Validates + normalises a create/update payload. `existing` (a loaded Doctor) is used for
 * cross-field checks on partial updates. Returns { clean, errors:[{field,message}] }.
 * Only whitelisted fields are copied — role, hospitalId, status, verification, documents,
 * userId etc. in the payload are IGNORED here by construction.
 */
function validateDoctorPayload(input, { isCreate, existing, hospitalDepartments }) {
  const errors = [];
  const clean = {};
  const err = (field, message) => errors.push({ field, message });
  const has = (k) => isCreate || input[k] !== undefined;

  // --- personal ---
  if (has('name')) {
    const v = str(input.name);
    if (!v || v.length < 2 || v.length > 100) err('name', 'Full name is required (2–100 characters)');
    else clean.name = v;
  }
  if (isCreate) {
    const v = str(input.email)?.toLowerCase();
    if (!v || !EMAIL_RE.test(v) || v.length > 120) err('email', 'A valid email address is required');
    else clean.email = v;
  }
  if (has('phone')) {
    const v = str(input.phone);
    if (!v || !PHONE_RE.test(v)) err('phone', 'A valid phone number is required');
    else clean.phone = v;
  }
  if (input.profilePhotoUrl !== undefined) {
    const v = str(input.profilePhotoUrl);
    if (v && !PHOTO_RE.test(v)) err('profilePhotoUrl', 'Profile photo must be uploaded through the profile-image uploader');
    else clean.profilePhotoUrl = v || undefined;
  }
  if (input.dateOfBirth !== undefined && input.dateOfBirth !== '') {
    const d = new Date(input.dateOfBirth);
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (Number.isNaN(d.getTime()) || age < 18 || age > 100) err('dateOfBirth', 'Date of birth must be a valid past date (age 18–100)');
    else clean.dateOfBirth = d;
  }
  if (input.gender !== undefined && input.gender !== '') {
    if (!['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(input.gender)) err('gender', 'Invalid gender value');
    else clean.gender = input.gender;
  }
  if (input.address !== undefined && input.address !== null) {
    const a = input.address || {};
    const addr = {};
    ['line1', 'city', 'state', 'pincode'].forEach((k) => { if (a[k]) addr[k] = String(a[k]).trim().slice(0, 200); });
    if (addr.pincode && !PIN_RE.test(addr.pincode)) err('address.pincode', 'PIN code must be 6 digits');
    else clean.address = addr;
  }

  // --- professional ---
  const category = getCategory(has('professionalCategory') ? input.professionalCategory : existing?.professionalCategory);
  if (has('professionalCategory')) {
    if (!getCategory(input.professionalCategory)) err('professionalCategory', 'Select a valid professional category');
    else clean.professionalCategory = input.professionalCategory;
  }
  if (has('specialization')) {
    const spec = getSpecialization(str(input.specialization));
    if (!spec) err('specialization', 'Select a valid primary specialization');
    else if (category && !spec.categories.includes(category.value)) err('specialization', `"${spec.label}" does not match the selected professional category`);
    else clean.specialization = spec.value;
  }
  if (input.additionalSpecializations !== undefined) {
    const list = Array.isArray(input.additionalSpecializations) ? [...new Set(input.additionalSpecializations.map(str))] : null;
    const primary = clean.specialization || existing?.specialization;
    if (!list || list.length > 8) err('additionalSpecializations', 'Choose up to 8 additional specializations');
    else {
      const bad = list.find((x) => {
        const s = getSpecialization(x);
        return !s || (category && !s.categories.includes(category.value));
      });
      if (bad) err('additionalSpecializations', `"${bad}" is not valid for the selected professional category`);
      else clean.additionalSpecializations = list.filter((x) => x !== primary);
    }
  }
  if (has('departmentId')) {
    const id = String(input.departmentId || '');
    if (!mongoose.isValidObjectId(id)) err('departmentId', 'Select a department');
    else if (hospitalDepartments && !hospitalDepartments.some((d) => String(d._id) === id)) err('departmentId', 'Department does not belong to this hospital or is inactive');
    else clean.departmentId = id;
  }
  if (has('qualification')) {
    const v = str(input.qualification);
    if (!v || v.length < 2 || v.length > 200) err('qualification', 'Qualifications are required (e.g. MBBS, MD)');
    else clean.qualification = v;
  }
  if (input.languages !== undefined) {
    const list = Array.isArray(input.languages) ? [...new Set(input.languages.map(str))] : null;
    if (!list || list.length > 12 || list.some((l) => !LANGUAGES.includes(l))) err('languages', 'Choose languages from the list');
    else clean.languages = list;
  }
  if (has('experience')) {
    if (!isNum(input.experience) || Number(input.experience) < 0 || Number(input.experience) > 70) err('experience', 'Experience must be a number between 0 and 70 years');
    else clean.experience = Number(input.experience);
  }
  if (input.bio !== undefined) {
    const v = str(input.bio) || '';
    if (v.length > 2000) err('bio', 'Biography must be 2000 characters or fewer');
    else clean.bio = v;
  }

  // registration (required where the category demands it)
  const reg = input.registration;
  if (isCreate || reg !== undefined) {
    const r = reg || {};
    const current = existing?.registration || {};
    const merged = {
      number: str(r.number !== undefined ? r.number : current.number) || '',
      council: str(r.council !== undefined ? r.council : current.council) || '',
      state: str(r.state !== undefined ? r.state : current.state) || '',
    };
    if (category?.registrationRequired) {
      if (!merged.number) err('registration.number', 'Professional registration number is required for this category');
      if (!merged.council) err('registration.council', 'Registration council is required for this category');
      if (!merged.state) err('registration.state', 'Registration state is required for this category');
    }
    if (merged.number && !REG_NO_RE.test(merged.number)) err('registration.number', 'Registration number format is invalid');
    if (!errors.some((e) => e.field.startsWith('registration.'))) {
      clean.registration = { number: merged.number || undefined, council: merged.council || undefined, state: merged.state || undefined };
    }
  }

  // --- hospital / consultation ---
  if (input.consultationRoom !== undefined) clean.consultationRoom = (str(input.consultationRoom) || '').slice(0, 60);
  if (has('consultationFee')) {
    if (!isNum(input.consultationFee) || Number(input.consultationFee) < 0 || Number(input.consultationFee) > 1000000) err('consultationFee', 'Consultation fee must be a non-negative number');
    else clean.consultationFee = Number(input.consultationFee);
  }
  if (input.followUpFee !== undefined && input.followUpFee !== '' && input.followUpFee !== null) {
    if (!isNum(input.followUpFee) || Number(input.followUpFee) < 0 || Number(input.followUpFee) > 1000000) err('followUpFee', 'Follow-up fee must be a non-negative number');
    else clean.followUpFee = Number(input.followUpFee);
  }
  if (input.appointmentDurationMinutes !== undefined) {
    const n = Number(input.appointmentDurationMinutes);
    if (!Number.isInteger(n) || n < 5 || n > 240) err('appointmentDurationMinutes', 'Appointment duration must be 5–240 minutes');
    else clean.appointmentDurationMinutes = n;
  }
  if (input.emergencyAvailable !== undefined) clean.emergencyAvailable = Boolean(input.emergencyAvailable);
  if (input.onlineConsultationAvailable !== undefined) clean.onlineConsultationAvailable = Boolean(input.onlineConsultationAvailable);
  if (has('consultationModes')) {
    const m = Array.isArray(input.consultationModes) ? [...new Set(input.consultationModes)] : null;
    if (!m || m.length === 0 || m.some((x) => !Object.values(CONSULTATION_MODES).includes(x))) err('consultationModes', 'Choose at least one consultation mode');
    else clean.consultationModes = m;
  }
  {
    const modes = clean.consultationModes || existing?.consultationModes || [];
    const online = clean.onlineConsultationAvailable !== undefined ? clean.onlineConsultationAvailable : existing?.onlineConsultationAvailable !== false;
    if (!online && modes.some((x) => ONLINE_MODES.includes(x)) && (clean.consultationModes || clean.onlineConsultationAvailable !== undefined)) {
      err('consultationModes', 'Online consultation is switched off, so video, audio and chat modes cannot be offered');
    }
  }

  // --- schedule ---
  if (input.availability !== undefined) {
    const duration = clean.appointmentDurationMinutes || existing?.appointmentDurationMinutes || 20;
    const problems = scheduleService.validateAvailability(input.availability);
    if (problems.length) problems.forEach((p) => err('availability', p));
    else clean.availability = scheduleService.cleanAvailability(input.availability, duration);
  }
  if (input.maxAppointmentsPerDay !== undefined && input.maxAppointmentsPerDay !== '' && input.maxAppointmentsPerDay !== null) {
    const n = Number(input.maxAppointmentsPerDay);
    if (!Number.isInteger(n) || n < 1 || n > 500) err('maxAppointmentsPerDay', 'Maximum appointments per day must be a whole number from 1 to 500');
    else clean.maxAppointmentsPerDay = n;
  } else if (input.maxAppointmentsPerDay === '' || input.maxAppointmentsPerDay === null) {
    clean.maxAppointmentsPerDay = null; // cleared
  }
  if (input.bookingEnabled !== undefined) clean.bookingEnabled = Boolean(input.bookingEnabled);
  if (input.leaveDates !== undefined) {
    const list = Array.isArray(input.leaveDates) ? [...new Set(input.leaveDates.map(str))] : null;
    if (!list || list.length > 366 || list.some((d) => !DATE_RE.test(d) || Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()))) err('leaveDates', 'Leave dates must be valid YYYY-MM-DD dates');
    else clean.leaveDates = list.sort();
  }

  return { clean, errors };
}

const throwIfErrors = (errors) => {
  if (errors.length) throw ApiError.badRequest('Validation failed', errors);
};

/* ------------------------------------------------------------------ invitations */

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** Creates a fresh one-time invitation on `user` (not saved) and returns the plaintext link ONCE. */
function issueInvitation(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.inviteTokenHash = hashToken(token);
  user.inviteExpiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
  return {
    // No mail provider is wired into this project: the link is handed to the administrator,
    // who must deliver it to the doctor over a trusted channel. Replace with a mailer to automate.
    inviteUrl: `${env.clientUrl.replace(/\/$/, '')}/accept-invite?token=${token}`,
    expiresAt: user.inviteExpiresAt,
    delivery: 'MANUAL',
  };
}

/* ------------------------------------------------------------------ serialization */

function serializeDoctor(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o.documents) o.documents = o.documents.map(({ storageKey, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return o;
}

async function missingDocuments(doctor) {
  const category = getCategory(doctor.professionalCategory);
  if (!category) return [];
  const have = new Set((doctor.documents || []).map((d) => d.type));
  return category.requiredDocuments.filter((t) => !have.has(t));
}

/* ------------------------------------------------------------------ operations */

async function listDoctors(actor, query, { page, limit, skip }) {
  const filter = listScope(actor);
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) filter.departmentId = query.departmentId;
  if (query.specialization) {
    const rx = new RegExp(`^${escapeRegex(query.specialization)}$`, 'i');
    filter.$and = [...(filter.$and || []), { $or: [{ specialization: rx }, { additionalSpecializations: rx }] }];
  }
  if (['ACTIVE', 'ON_LEAVE', 'INACTIVE'].includes(query.status)) filter.status = query.status;
  if (Object.values(VERIFICATION_STATUS).includes(query.verification)) filter['verification.status'] = query.verification;

  const userCond = {};
  if (Object.values(USER_STATUS).includes(query.account)) userCond.status = query.account;
  if (query.q) {
    const rx = new RegExp(escapeRegex(String(query.q).trim().slice(0, 80)), 'i');
    const matchingUsers = await User.find({ role: ROLES.DOCTOR, $or: [{ name: rx }, { email: rx }, { phone: rx }] }).distinct('_id');
    filter.$and = [...(filter.$and || []), { $or: [{ userId: { $in: matchingUsers } }, { specialization: rx }] }];
  }
  if (Object.keys(userCond).length) {
    const ids = await User.find({ role: ROLES.DOCTOR, ...userCond }).distinct('_id');
    filter.userId = { $in: ids };
  }

  const [items, total] = await Promise.all([
    Doctor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email phone status emailVerified lastLoginAt')
      .populate('departmentId', 'name'),
    Doctor.countDocuments(filter),
  ]);
  return { items: items.map(serializeDoctor), total };
}

async function getDoctor(actor, id) {
  const doctor = await loadDoctor(actor, id);
  await doctor.populate([
    { path: 'userId', select: 'name email phone status emailVerified lastLoginAt createdAt inviteExpiresAt' },
    { path: 'departmentId', select: 'name' },
    { path: 'hospitalId', select: 'name' },
    { path: 'createdBy', select: 'name role' },
    { path: 'verification.verifiedBy', select: 'name role' },
  ]);
  const category = getCategory(doctor.professionalCategory);
  const out = serializeDoctor(doctor);
  out.requiredDocuments = category?.requiredDocuments || [];
  out.missingDocuments = await missingDocuments(doctor);
  return out;
}

async function listHospitalDepartments(hospitalId) {
  return Department.find({ hospitalId, status: 'ACTIVE' }).select('name');
}

async function createDoctor(actor, input) {
  const hospitalId = resolveHospitalId(actor, input.hospitalId);
  const hospital = await Hospital.findById(hospitalId).select('name status');
  if (!hospital || hospital.status !== 'ACTIVE') throw ApiError.badRequest('Hospital not found or inactive');

  const departments = await listHospitalDepartments(hospitalId);
  const { clean, errors } = validateDoctorPayload(input, { isCreate: true, hospitalDepartments: departments });
  throwIfErrors(errors);

  // Friendly duplicate checks (the unique indexes remain the real guarantee).
  if (await User.exists({ email: clean.email })) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const reg = clean.registration;
  if (reg?.number && (await Doctor.exists({ 'registration.number': reg.number, 'registration.council': reg.council, 'registration.state': reg.state }))) {
    throw ApiError.conflict('A doctor with this registration number is already registered');
  }

  // Unusable random password: the doctor sets their own through the invitation link.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);

  const userDoc = new User({
    name: clean.name,
    email: clean.email,
    phone: clean.phone,
    passwordHash,
    role: ROLES.DOCTOR, // fixed — never read from the request
    status: USER_STATUS.PENDING_VERIFICATION,
    hospitalId,
    emailVerified: false,
    createdBy: actor._id,
  });
  const invitation = issueInvitation(userDoc);

  const duration = clean.appointmentDurationMinutes || 20;
  const doctorFields = {
    departmentId: clean.departmentId,
    hospitalId, // from the authorised context, never from the payload
    qualification: clean.qualification,
    specialization: clean.specialization,
    additionalSpecializations: clean.additionalSpecializations || [],
    professionalCategory: clean.professionalCategory,
    experience: clean.experience,
    consultationFee: clean.consultationFee,
    followUpFee: clean.followUpFee,
    bio: clean.bio,
    languages: clean.languages || [],
    gender: clean.gender,
    dateOfBirth: clean.dateOfBirth,
    address: clean.address,
    profilePhotoUrl: clean.profilePhotoUrl,
    registration: clean.registration,
    consultationRoom: clean.consultationRoom,
    consultationModes: clean.consultationModes,
    appointmentDurationMinutes: duration,
    emergencyAvailable: clean.emergencyAvailable ?? false,
    onlineConsultationAvailable: clean.onlineConsultationAvailable ?? true,
    availability: clean.availability || [],
    maxAppointmentsPerDay: clean.maxAppointmentsPerDay || undefined,
    bookingEnabled: clean.bookingEnabled ?? true,
    leaveDates: clean.leaveDates || [],
    status: 'INACTIVE', // activated explicitly once the invitation is accepted
    verification: { status: VERIFICATION_STATUS.PENDING },
    createdBy: actor._id,
  };

  const created = await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    await userDoc.save(opts);
    try {
      const doctor = new Doctor({ ...doctorFields, userId: userDoc._id });
      await doctor.save(opts);
      return doctor;
    } catch (e) {
      // Without a transaction, compensate so no orphaned User is left behind.
      if (!session) await User.deleteOne({ _id: userDoc._id });
      throw e;
    }
  });

  const doctor = await getDoctor(actor, created._id);
  return { doctor, invitation, hospitalId, changes: { email: clean.email, specialization: clean.specialization, departmentId: clean.departmentId } };
}

async function updateDoctor(actor, id, input) {
  const doctor = await loadDoctor(actor, id);

  if (input.hospitalId && String(input.hospitalId) !== String(doctor.hospitalId)) {
    throw actor.role === ROLES.HOSPITAL_ADMIN
      ? ApiError.forbidden('You can only manage doctors of your own hospital')
      : ApiError.badRequest('Doctors cannot be moved between hospitals');
  }

  const departments = await listHospitalDepartments(doctor.hospitalId);
  const { clean, errors } = validateDoctorPayload(input, { isCreate: false, existing: doctor, hospitalDepartments: departments });
  throwIfErrors(errors);

  // Which fields actually change (for the audit trail)
  const before = {};
  const after = {};
  const credentialChange = [];
  for (const [k, v] of Object.entries(clean)) {
    if (['name', 'phone'].includes(k)) continue;
    const prev = doctor.get(k);
    const same = JSON.stringify(prev && prev.toObject ? prev.toObject() : prev) === JSON.stringify(v);
    if (!same) {
      before[k] = prev && prev.toObject ? prev.toObject() : prev;
      after[k] = v;
      if (['professionalCategory', 'qualification', 'registration'].includes(k)) credentialChange.push(k);
    }
  }

  // Duplicate registration number guard
  if (clean.registration?.number) {
    const dup = await Doctor.exists({
      _id: { $ne: doctor._id },
      'registration.number': clean.registration.number,
      'registration.council': clean.registration.council,
      'registration.state': clean.registration.state,
    });
    if (dup) throw ApiError.conflict('A doctor with this registration number is already registered');
  }

  const { name, phone, ...doctorFields } = clean;
  doctor.set(doctorFields);
  if (clean.maxAppointmentsPerDay === null) doctor.maxAppointmentsPerDay = undefined;

  // Changing credentials invalidates a previous verification decision.
  let verificationReset = false;
  if (credentialChange.length && doctor.verification?.status === VERIFICATION_STATUS.VERIFIED) {
    doctor.verification.status = VERIFICATION_STATUS.PENDING;
    doctor.verification.verifiedAt = undefined;
    doctor.verification.verifiedBy = undefined;
    doctor.verification.notes = `Re-verification required: ${credentialChange.join(', ')} changed`;
    verificationReset = true;
  }

  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    await doctor.save(opts);
    if (name !== undefined || phone !== undefined) {
      const upd = {};
      if (name !== undefined) upd.name = name;
      if (phone !== undefined) upd.phone = phone;
      await User.updateOne({ _id: doctor.userId }, { $set: upd }, opts);
      if (name !== undefined) { before.name = '(previous)'; after.name = name; }
      if (phone !== undefined) { after.phone = '(updated)'; }
    }
  });

  return { doctor: await getDoctor(actor, id), changes: { before, after, verificationReset }, hospitalId: doctor.hospitalId };
}

async function upcomingAppointmentCount(doctorId) {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  return Appointment.countDocuments({ doctorId, date: { $gte: today }, status: { $in: scheduleService.ACTIVE_APPT } });
}

async function setStatus(actor, id, status) {
  if (!['ACTIVE', 'INACTIVE', 'ON_LEAVE'].includes(status)) {
    throw ApiError.badRequest('Validation failed', [{ field: 'status', message: 'status must be ACTIVE, INACTIVE or ON_LEAVE' }]);
  }
  const doctor = await loadDoctor(actor, id, { sensitive: false });
  const user = await User.findById(doctor.userId).select('+inviteTokenHash');
  if (!user) throw ApiError.notFound('Doctor account not found');
  const previous = { doctorStatus: doctor.status, accountStatus: user.status };

  if (status === 'ACTIVE') {
    if (user.status === USER_STATUS.DELETED) throw ApiError.conflict('This account has been deleted and cannot be activated');
    if (user.status === USER_STATUS.PENDING_VERIFICATION) {
      throw ApiError.conflict('The doctor has not accepted the account invitation yet. Resend the invitation first.');
    }
  }

  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    doctor.status = status;
    await doctor.save(opts);
    if (status === 'INACTIVE' && user.status === USER_STATUS.ACTIVE) {
      // Immediate lock-out: authenticate() rejects non-ACTIVE users on every request, and the
      // tokenVersion bump revokes outstanding refresh tokens.
      user.status = USER_STATUS.SUSPENDED;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save(opts);
    } else if (status === 'ACTIVE' && user.status === USER_STATUS.SUSPENDED) {
      user.status = USER_STATUS.ACTIVE;
      await user.save(opts);
    }
  });

  const affectedUpcomingAppointments = status === 'ACTIVE' ? 0 : await upcomingAppointmentCount(doctor._id);
  return { doctor, previous, current: { doctorStatus: doctor.status, accountStatus: user.status }, affectedUpcomingAppointments, hospitalId: doctor.hospitalId };
}

async function resendInvitation(actor, id) {
  const doctor = await loadDoctor(actor, id, { sensitive: false });
  const user = await User.findById(doctor.userId).select('+inviteTokenHash +inviteExpiresAt');
  if (!user || user.status !== USER_STATUS.PENDING_VERIFICATION) {
    throw ApiError.conflict('This doctor has already accepted the invitation or the account is not awaiting one');
  }
  const invitation = issueInvitation(user);
  await user.save();
  return { invitation, hospitalId: doctor.hospitalId, doctorId: doctor._id };
}

async function recordVerification(actor, id, { decision, notes }) {
  if (!Object.values(VERIFICATION_STATUS).includes(decision)) {
    throw ApiError.badRequest('Validation failed', [{ field: 'decision', message: 'decision must be VERIFIED, REJECTED or PENDING' }]);
  }
  const note = str(notes) || '';
  if (note.length > 1000) throw ApiError.badRequest('Validation failed', [{ field: 'notes', message: 'Notes must be 1000 characters or fewer' }]);
  if (decision === VERIFICATION_STATUS.REJECTED && !note) {
    throw ApiError.badRequest('Validation failed', [{ field: 'notes', message: 'Please record the reason for rejection' }]);
  }

  const doctor = await loadDoctor(actor, id);
  if (decision === VERIFICATION_STATUS.VERIFIED) {
    // Entering a registration number is NOT verification: documents must be on file for review.
    const category = getCategory(doctor.professionalCategory);
    const missing = await missingDocuments(doctor);
    if (missing.length) {
      throw ApiError.badRequest('Cannot verify yet', [{ field: 'documents', message: `Upload the required document(s) first: ${missing.join(', ')}` }]);
    }
    if (category?.registrationRequired && !(doctor.registration?.number && doctor.registration?.council && doctor.registration?.state)) {
      throw ApiError.badRequest('Cannot verify yet', [{ field: 'registration', message: 'Registration number, council and state are required' }]);
    }
  }

  const previous = doctor.verification?.status;
  doctor.verification.status = decision;
  doctor.verification.notes = note || undefined;
  if (decision === VERIFICATION_STATUS.PENDING) {
    doctor.verification.verifiedBy = undefined;
    doctor.verification.verifiedAt = undefined;
    doctor.verification.method = undefined;
  } else {
    doctor.verification.verifiedBy = actor._id;
    doctor.verification.verifiedAt = new Date();
    doctor.verification.method = 'MANUAL_DOCUMENT_REVIEW';
  }
  await doctor.save();
  return { doctor: await getDoctor(actor, id), previous, hospitalId: doctor.hospitalId };
}

/* ---- documents ---- */

const MAGIC = {
  'application/pdf': (b) => b.slice(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

async function discardFile(file) {
  try { await fs.unlink(file.path); } catch (e) { /* already gone */ }
}

async function addDocument(actor, id, file, { type, title }) {
  if (!file) throw ApiError.badRequest('No file uploaded');
  try {
    if (!Object.values(DOCUMENT_TYPES).includes(type)) {
      throw ApiError.badRequest('Validation failed', [{ field: 'type', message: 'Invalid document type' }]);
    }
    const doctor = await loadDoctor(actor, id); // ownership check first
    if ((doctor.documents || []).length >= MAX_DOCS) throw ApiError.badRequest(`A doctor can have at most ${MAX_DOCS} documents`);

    // Verify real content type from the file signature (the client-supplied MIME is not trusted).
    const fh = await fs.open(file.path, 'r');
    const buf = Buffer.alloc(8);
    await fh.read(buf, 0, 8, 0);
    await fh.close();
    if (!MAGIC[file.mimetype] || !MAGIC[file.mimetype](buf)) throw ApiError.badRequest('File content does not match its type');

    doctor.documents.push({
      type,
      title: (str(title) || '').slice(0, 120) || undefined,
      originalName: path.basename(file.originalname || 'document').slice(0, 255),
      mimeType: file.mimetype,
      size: file.size,
      storageKey: path.basename(file.path),
      uploadedBy: actor._id,
    });
    await doctor.save();
    const added = doctor.documents[doctor.documents.length - 1];
    const { storageKey, ...safe } = added.toObject(); // eslint-disable-line no-unused-vars
    return { document: safe, doctorId: doctor._id, hospitalId: doctor.hospitalId };
  } catch (e) {
    await discardFile(file);
    throw e;
  }
}

async function removeDocument(actor, id, docId) {
  const doctor = await loadDoctor(actor, id);
  const doc = doctor.documents.id(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  const key = doc.storageKey;
  const meta = { type: doc.type, originalName: doc.originalName };
  doc.deleteOne();
  let verificationReset = false;
  if (doctor.verification?.status === VERIFICATION_STATUS.VERIFIED && (await missingDocuments(doctor)).length) {
    doctor.verification.status = VERIFICATION_STATUS.PENDING;
    doctor.verification.notes = 'Re-verification required: a required document was removed';
    verificationReset = true;
  }
  await doctor.save();
  if (key) { try { await fs.unlink(path.join(PRIVATE_DOC_DIR, path.basename(key))); } catch (e) { /* ignore */ } }
  return { meta, verificationReset, hospitalId: doctor.hospitalId };
}

async function getDocumentFile(actor, id, docId) {
  const doctor = await loadDoctor(actor, id);
  const doc = doctor.documents.id(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  const full = path.join(PRIVATE_DOC_DIR, path.basename(doc.storageKey)); // basename() blocks path traversal
  try { await fs.access(full); } catch (e) { throw ApiError.notFound('Document file is missing'); }
  return { path: full, name: doc.originalName || 'document', mimeType: doc.mimeType, meta: { type: doc.type }, hospitalId: doctor.hospitalId, doctorId: doctor._id };
}

/* ---- departments (so a hospital only offers the departments it actually has) ---- */

async function createDepartment(actor, { name, description, hospitalId: bodyHospitalId }) {
  const hospitalId = resolveHospitalId(actor, bodyHospitalId);
  const n = str(name);
  if (!n || n.length < 2 || n.length > 80) throw ApiError.badRequest('Validation failed', [{ field: 'name', message: 'Department name is required (2–80 characters)' }]);
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) throw ApiError.notFound('Hospital not found');
  const existing = await Department.findOne({ hospitalId, name: new RegExp(`^${escapeRegex(n)}$`, 'i') });
  if (existing) throw ApiError.conflict('This hospital already has a department with that name');
  const dept = await Department.create({ name: n, description: (str(description) || '').slice(0, 300), hospitalId });
  await Hospital.updateOne({ _id: hospitalId }, { $addToSet: { departments: dept._id } });
  return { department: dept, hospitalId };
}

module.exports = {
  resolveHospitalId,
  assertHospitalAccess,
  validateDoctorPayload,
  hashToken,
  issueInvitation,
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  setStatus,
  resendInvitation,
  recordVerification,
  addDocument,
  removeDocument,
  getDocumentFile,
  createDepartment,
  upcomingAppointmentCount,
};
