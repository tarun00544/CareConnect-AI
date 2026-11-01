const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const MedicalRecord = require('../models/MedicalRecord');
const Admission = require('../models/Admission');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const ApiError = require('../utils/ApiError');
const { escapeRegex } = require('../utils/regex');
const { runInTransaction } = require('../utils/transaction');
const { ROLES, USER_STATUS } = require('../config/constants');
const doctorAdmin = require('./doctorAdminService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,16}$/;
// Roles that carry NO profile record, so they can be swapped safely. PATIENT and DOCTOR users own
// Patient/Doctor profiles (and clinical history), which cannot be conjured or discarded by a role flip.
const STAFF_ROLES = [ROLES.HOSPITAL_ADMIN, ROLES.PHARMACY_ADMIN, ROLES.SUPER_ADMIN];

const publicUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status,
  hospitalId: u.hospitalId, emailVerified: u.emailVerified, lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt, updatedAt: u.updatedAt, deletedAt: u.deletedAt,
});

async function activeSuperAdminsExcluding(userId) {
  return User.countDocuments({ role: ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE, _id: { $ne: userId } });
}

/** Blocks the actor locking themselves out, and the platform losing its last active Super Admin. */
async function assertSafeToRemove(actor, target, verb) {
  if (String(actor._id) === String(target._id)) throw ApiError.badRequest(`You cannot ${verb} your own account`);
  if (target.role === ROLES.SUPER_ADMIN && target.status === USER_STATUS.ACTIVE && (await activeSuperAdminsExcluding(target._id)) < 1) {
    throw ApiError.conflict(`The last active Super Admin cannot be ${verb === 'delete' ? 'deleted' : 'deactivated'}`);
  }
}

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid user id');
  const user = await User.findById(id).select('+inviteTokenHash');
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function listUsers(query, { skip, limit }) {
  const filter = {};
  if (Object.values(ROLES).includes(query.role)) filter.role = query.role;
  if (Object.values(USER_STATUS).includes(query.status)) filter.status = query.status;
  else filter.status = { $ne: USER_STATUS.DELETED }; // anonymised accounts only show when asked for
  if (query.q) {
    const rx = new RegExp(escapeRegex(String(query.q).trim().slice(0, 80)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: items.map(publicUser), total };
}

async function getUser(id) {
  const user = await load(id);
  const out = publicUser(user);
  const [doctor, patient, hospital] = await Promise.all([
    user.role === ROLES.DOCTOR ? Doctor.findOne({ userId: user._id }).populate('departmentId', 'name').populate('hospitalId', 'name') : null,
    user.role === ROLES.PATIENT ? Patient.exists({ userId: user._id }) : null,
    user.hospitalId ? Hospital.findById(user.hospitalId).select('name') : null,
  ]);
  out.hospital = hospital ? { _id: hospital._id, name: hospital.name } : null;
  out.doctorProfile = doctor ? { _id: doctor._id, specialization: doctor.specialization, department: doctor.departmentId?.name, hospital: doctor.hospitalId?.name, status: doctor.status, verification: doctor.verification?.status } : null;
  out.hasPatientProfile = Boolean(patient);
  out.pendingInvitation = Boolean(user.inviteTokenHash);
  return out;
}

async function updateUser(actor, id, input) {
  const user = await load(id);
  if (user.status === USER_STATUS.DELETED) throw ApiError.conflict('Deleted accounts cannot be edited');
  const errors = [];
  const before = {};
  const after = {};

  if (input.name !== undefined) {
    const v = String(input.name).trim();
    if (v.length < 2 || v.length > 100) errors.push({ field: 'name', message: 'Name must be 2–100 characters' });
    else if (v !== user.name) { before.name = user.name; after.name = v; }
  }
  if (input.phone !== undefined) {
    const v = String(input.phone || '').trim();
    if (v && !PHONE_RE.test(v)) errors.push({ field: 'phone', message: 'Enter a valid phone number' });
    else if (v !== (user.phone || '')) { before.phone = '(previous)'; after.phone = '(updated)'; }
  }
  if (input.email !== undefined) {
    const v = String(input.email).trim().toLowerCase();
    if (!EMAIL_RE.test(v)) errors.push({ field: 'email', message: 'Enter a valid email address' });
    else if (v !== user.email) {
      if (await User.exists({ email: v, _id: { $ne: user._id } })) errors.push({ field: 'email', message: 'Another account already uses this email' });
      else { before.email = user.email; after.email = v; }
    }
  }

  // ---- role / hospital changes: Super Admin only (route-level) and tightly constrained ----
  let roleChanged = false;
  let nextRole = user.role;
  let nextHospital = user.hospitalId;
  if (input.role !== undefined && input.role !== user.role) {
    if (!Object.values(ROLES).includes(input.role)) errors.push({ field: 'role', message: 'Invalid role' });
    else if (String(actor._id) === String(user._id)) errors.push({ field: 'role', message: 'You cannot change your own role' });
    else if (!STAFF_ROLES.includes(input.role) || !STAFF_ROLES.includes(user.role)) {
      errors.push({ field: 'role', message: 'Patient and Doctor accounts own clinical profiles, so their role cannot be changed. Create a new staff account instead.' });
    } else if (user.role === ROLES.SUPER_ADMIN && user.status === USER_STATUS.ACTIVE && (await activeSuperAdminsExcluding(user._id)) < 1) {
      throw ApiError.conflict('The last active Super Admin cannot be demoted');
    } else { nextRole = input.role; roleChanged = true; before.role = user.role; after.role = input.role; }
  }
  if (input.hospitalId !== undefined || roleChanged) {
    if (nextRole === ROLES.HOSPITAL_ADMIN) {
      const hid = input.hospitalId !== undefined ? input.hospitalId : user.hospitalId;
      if (!hid || !mongoose.isValidObjectId(hid) || !(await Hospital.exists({ _id: hid }))) errors.push({ field: 'hospitalId', message: 'Hospital admins must be assigned to an existing hospital' });
      else { nextHospital = hid; if (String(hid) !== String(user.hospitalId)) { before.hospitalId = user.hospitalId; after.hospitalId = hid; } }
    } else if (user.role === ROLES.DOCTOR) {
      if (input.hospitalId !== undefined && String(input.hospitalId) !== String(user.hospitalId)) errors.push({ field: 'hospitalId', message: "A doctor's hospital is managed on the doctor profile" });
    } else if (input.hospitalId !== undefined && input.hospitalId) {
      errors.push({ field: 'hospitalId', message: 'Only hospital admins and doctors belong to a hospital' });
    } else if (roleChanged) nextHospital = null;
  }
  if (errors.length) throw ApiError.badRequest('Validation failed', errors);
  if (!Object.keys(after).length) return { user: await getUser(id), changes: {}, roleChanged: false };

  if (after.name !== undefined) user.name = after.name;
  if (input.phone !== undefined) user.phone = String(input.phone || '').trim() || undefined;
  if (after.email !== undefined) user.email = after.email;
  if (roleChanged) { user.role = nextRole; user.tokenVersion = (user.tokenVersion || 0) + 1; }
  if (roleChanged || after.hospitalId !== undefined) user.hospitalId = nextHospital;
  await user.save(); // E11000 on a racing duplicate email is mapped to 409 by the error handler
  return { user: await getUser(id), changes: { before, after }, roleChanged };
}

async function setStatus(actor, id, status) {
  if (![USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED].includes(status)) {
    throw ApiError.badRequest('Validation failed', [{ field: 'status', message: 'status must be ACTIVE or SUSPENDED' }]);
  }
  const user = await load(id);
  if (user.status === USER_STATUS.DELETED) throw ApiError.conflict('Deleted accounts cannot be changed');
  if (user.status === status) return { user: await getUser(id), previous: user.status, changed: false };
  const previous = user.status;

  if (status === USER_STATUS.SUSPENDED) {
    await assertSafeToRemove(actor, user, 'deactivate');
  } else if (user.status === USER_STATUS.PENDING_VERIFICATION || user.inviteTokenHash) {
    throw ApiError.conflict('This user has not accepted their invitation yet, so the account cannot be activated');
  }

  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    user.status = status;
    if (status === USER_STATUS.SUSPENDED) user.tokenVersion = (user.tokenVersion || 0) + 1; // revoke refresh tokens
    await user.save(opts);
    if (user.role === ROLES.DOCTOR) {
      // Keep the doctor profile in step so a suspended doctor cannot take new bookings.
      await Doctor.updateOne({ userId: user._id }, { $set: { status: status === USER_STATUS.SUSPENDED ? 'INACTIVE' : 'ACTIVE' } }, opts);
    }
  });

  let affectedUpcomingAppointments = 0;
  if (status === USER_STATUS.SUSPENDED && user.role === ROLES.DOCTOR) {
    const d = await Doctor.findOne({ userId: user._id }).select('_id');
    if (d) affectedUpcomingAppointments = await doctorAdmin.upcomingAppointmentCount(d._id);
  }
  return { user: await getUser(id), previous, changed: true, affectedUpcomingAppointments };
}

/**
 * Safe deletion = ANONYMISATION. Healthcare, billing and appointment history is retained for
 * legal/clinical continuity; only the personal identity is removed and the login is destroyed.
 * Nothing is hard-deleted. Retention periods are a policy decision for the hospital — adjust here.
 */
async function deleteUser(actor, id, { confirmEmail }) {
  const user = await load(id);
  if (user.status === USER_STATUS.DELETED) throw ApiError.conflict('This account has already been deleted');
  if (!confirmEmail || String(confirmEmail).trim().toLowerCase() !== user.email) {
    throw ApiError.badRequest('Validation failed', [{ field: 'confirmEmail', message: "Type the user's email address to confirm deletion" }]);
  }
  await assertSafeToRemove(actor, user, 'delete');

  const originalEmail = user.email;
  const originalRole = user.role;
  // Retention summary (what is KEPT, linked to the anonymised account) — shown to the admin and audited.
  const [patientProfile, doctorProfile] = await Promise.all([
    originalRole === ROLES.PATIENT ? Patient.findOne({ userId: user._id }).select('_id') : null,
    originalRole === ROLES.DOCTOR ? Doctor.findOne({ userId: user._id }).select('_id') : null,
  ]);
  const retained = {
    appointments: patientProfile ? await Appointment.countDocuments({ patientId: patientProfile._id }) : doctorProfile ? await Appointment.countDocuments({ doctorId: doctorProfile._id }) : 0,
    payments: await Payment.countDocuments({ userId: user._id }),
    orders: patientProfile ? await Order.countDocuments({ patientId: patientProfile._id }) : 0,
    medicalRecords: patientProfile ? await MedicalRecord.countDocuments({ patientId: patientProfile._id }) : 0,
    admissions: patientProfile ? await Admission.countDocuments({ patientId: patientProfile._id }) : 0,
    prescriptions: patientProfile ? await Prescription.countDocuments({ patientId: patientProfile._id }) : 0,
  };

  const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    user.name = 'Deleted User';
    user.email = `deleted-${user._id}@deleted.invalid`;
    user.phone = undefined;
    user.passwordHash = randomHash;
    user.status = USER_STATUS.DELETED;
    user.deletedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.inviteTokenHash = undefined;
    user.inviteExpiresAt = undefined;
    user.emailVerified = false;
    await user.save(opts);

    if (originalRole === ROLES.PATIENT) {
      // Drop identifying demographics/contacts; keep the clinical content that records point at.
      await Patient.updateOne({ userId: user._id }, { $unset: { dateOfBirth: '', address: '', emergencyContact: '' } }, opts);
    }
    if (originalRole === ROLES.DOCTOR) {
      await Doctor.updateOne(
        { userId: user._id },
        { $set: { status: 'INACTIVE', bookingEnabled: false }, $unset: { profilePhotoUrl: '', dateOfBirth: '', address: '', bio: '' } },
        opts
      );
    }
  });

  const affectedUpcomingAppointments = doctorProfile ? await doctorAdmin.upcomingAppointmentCount(doctorProfile._id) : 0;
  return {
    user: await getUser(id),
    retained,
    affectedUpcomingAppointments,
    audit: { originalRole, originalEmailDomain: originalEmail.split('@')[1] },
  };
}

module.exports = { listUsers, getUser, updateUser, setStatus, deleteUser };
