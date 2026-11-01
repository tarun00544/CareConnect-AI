/* eslint-disable no-console */
// Integration tests for Doctor Management + User Management (plus the patient booking rules).
//
//   MONGO_URI=mongodb://127.0.0.1:27017/careconnect_test JWT_SECRET=x JWT_REFRESH_SECRET=y NODE_ENV=test npm test
//
// SAFETY: the suite DELETES every document in the target database, so it refuses to run unless
// the database name contains "test".
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
const uri = process.env.MONGO_URI || '';
if (!/\/[^/?]*test[^/?]*(\?|$)/i.test(uri)) {
  console.error('Refusing to run: MONGO_URI must point at a database whose name contains "test".');
  process.exit(1);
}

const app = require('../app');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const Department = require('../models/Department');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');
const { generateAccessToken } = require('../utils/generateTokens');
const userAdminService = require('../services/userAdminService');

let server;
let base;
const S = {}; // shared state

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${base}${path}`, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body: data, headers: res.headers };
}

const mkUser = async (over) => User.create({ passwordHash: await bcrypt.hash('Password@123', 4), emailVerified: true, ...over });
const tokenFor = (u) => generateAccessToken(u);

// A fully valid doctor payload (hospital admin A / dept A1)
const doctorPayload = (over = {}) => ({
  name: 'Dr. Meera Nair', email: 'meera.nair@example.com', phone: '+91 98765 43210',
  gender: 'FEMALE', address: { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  professionalCategory: 'MEDICAL_DOCTOR', specialization: 'Cardiologist', additionalSpecializations: ['Internal Medicine'],
  departmentId: String(S.deptA1._id), qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
  registration: { number: 'MMC-2011-45678', council: 'Maharashtra Medical Council', state: 'Maharashtra' },
  experience: 12, bio: 'Interventional cardiology.', languages: ['English', 'Hindi'],
  consultationRoom: 'Room 12', consultationModes: ['IN_PERSON', 'VIDEO'], appointmentDurationMinutes: 20,
  consultationFee: 900, followUpFee: 500, emergencyAvailable: true, onlineConsultationAvailable: true,
  availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20, breakStartTime: '11:00', breakEndTime: '11:20' }],
  maxAppointmentsPerDay: 10, bookingEnabled: true, leaveDates: [],
  ...over,
});

// Next Monday as YYYY-MM-DD (UTC) — a day in the doctor's schedule
function nextMonday(offsetWeeks = 1) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + 7 * (offsetWeeks - 1));
  return d.toISOString().slice(0, 10);
}

const pdfForm = (name = 'reg.pdf', type = 'REGISTRATION_CERTIFICATE', bytes = '%PDF-1.4\n%test\n', mime = 'application/pdf') => {
  const f = new FormData();
  f.append('type', type);
  f.append('title', 'Certificate');
  f.append('document', new Blob([bytes], { type: mime }), name);
  return f;
};

before(async () => {
  await mongoose.connect(uri);
  await Promise.all([User, Doctor, Hospital, Department, Patient, Appointment, AuditLog].map((m) => m.deleteMany({})));
  await Promise.all([User, Doctor, Department, Appointment].map((m) => m.syncIndexes().catch(() => {})));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;

  S.hospA = await Hospital.create({ name: 'Hospital A' });
  S.hospB = await Hospital.create({ name: 'Hospital B' });
  S.deptA1 = await Department.create({ name: 'Cardiology', hospitalId: S.hospA._id });
  S.deptA2 = await Department.create({ name: 'General Medicine', hospitalId: S.hospA._id });
  S.deptB1 = await Department.create({ name: 'Neurology', hospitalId: S.hospB._id });
  S.sa1 = await mkUser({ name: 'SA One', email: 'sa1@t.com', role: 'SUPER_ADMIN' });
  S.haA = await mkUser({ name: 'HA A', email: 'ha-a@t.com', role: 'HOSPITAL_ADMIN', hospitalId: S.hospA._id });
  S.haB = await mkUser({ name: 'HA B', email: 'ha-b@t.com', role: 'HOSPITAL_ADMIN', hospitalId: S.hospB._id });
  S.haNone = await mkUser({ name: 'HA none', email: 'ha-none@t.com', role: 'HOSPITAL_ADMIN' });
  S.patUser = await mkUser({ name: 'Pat One', email: 'pat1@t.com', role: 'PATIENT' });
  S.patient = await Patient.create({ userId: S.patUser._id, address: { city: 'X' } });
  S.tSA = tokenFor(S.sa1); S.tHA = tokenFor(S.haA); S.tHB = tokenFor(S.haB); S.tHN = tokenFor(S.haNone); S.tPat = tokenFor(S.patUser);
});

after(async () => {
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
});

/* ============================================================ TEST A — add doctor */
describe('A. Hospital Admin adds a doctor', () => {
  it('creates a linked User + Doctor in the admin\'s own hospital', async () => {
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload() });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    S.docId = r.body.data.doctor._id;
    S.invite = r.body.data.invitation;
    const doc = await Doctor.findById(S.docId);
    const user = await User.findById(doc.userId).select('+inviteTokenHash');
    assert.equal(String(doc.hospitalId), String(S.hospA._id));
    assert.equal(user.role, 'DOCTOR');
    assert.equal(user.status, 'PENDING_VERIFICATION');
    assert.equal(user.email, 'meera.nair@example.com');
    assert.ok(user.passwordHash === undefined, 'hash is not selected by default');
    assert.notEqual(user.inviteTokenHash, S.invite.inviteUrl.split('token=')[1], 'only a hash of the token is stored');
    assert.equal(doc.verification.status, 'PENDING');
    assert.equal(doc.status, 'INACTIVE');
    assert.equal(String(doc.createdBy), String(S.haA._id));
    assert.equal(r.body.data.doctor.documents.length, 0);
    assert.ok(!JSON.stringify(r.body).includes('passwordHash'));
  });

  it('shows the doctor in the correct hospital listing only', async () => {
    const a = await call('GET', '/api/admin/doctors', { token: S.tHA });
    assert.ok(a.body.data.items.some((d) => d._id === S.docId));
    const b = await call('GET', '/api/admin/doctors', { token: S.tHB });
    assert.equal(b.body.data.items.length, 0);
  });

  it('rejects duplicate email without creating another account', async () => {
    const before = await User.countDocuments();
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ registration: { number: 'MMC-OTHER-1', council: 'Maharashtra Medical Council', state: 'Maharashtra' } }) });
    assert.equal(r.status, 409);
    assert.equal(await User.countDocuments(), before);
  });

  it('rejects a duplicate registration number', async () => {
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ email: 'other@example.com' }) });
    assert.equal(r.status, 409);
    assert.equal(await User.countDocuments({ email: 'other@example.com' }), 0);
  });

  it('ignores role / hospital / verification / status smuggled into the payload', async () => {
    const r = await call('POST', '/api/admin/doctors', {
      token: S.tHA,
      body: doctorPayload({ email: 'smuggle@example.com', registration: { number: 'MMC-SMUG-1', council: 'Maharashtra Medical Council', state: 'Maharashtra' }, role: 'SUPER_ADMIN', status: 'ACTIVE', verification: { status: 'VERIFIED' }, userId: String(S.sa1._id) }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const doc = await Doctor.findById(r.body.data.doctor._id);
    const user = await User.findById(doc.userId);
    assert.equal(user.role, 'DOCTOR');
    assert.equal(doc.verification.status, 'PENDING');
    assert.equal(doc.status, 'INACTIVE');
    assert.notEqual(String(doc.userId), String(S.sa1._id));
    S.pendingDocId = String(doc._id);
  });

  it('refuses to assign a doctor to another hospital via the payload (403)', async () => {
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ email: 'x1@example.com', hospitalId: String(S.hospB._id) }) });
    assert.equal(r.status, 403);
    assert.equal(await User.countDocuments({ email: 'x1@example.com' }), 0);
  });

  it('rejects a department from another hospital', async () => {
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ email: 'x2@example.com', departmentId: String(S.deptB1._id) }) });
    assert.equal(r.status, 400);
    assert.ok(r.body.details.some((d) => d.field === 'departmentId'));
  });

  it('returns field-level validation errors', async () => {
    const r = await call('POST', '/api/admin/doctors', {
      token: S.tHA,
      body: doctorPayload({ email: 'not-an-email', phone: '12', consultationFee: -5, experience: -1, specialization: 'Dentist', registration: {}, availability: [{ dayOfWeek: 1, startTime: '13:00', endTime: '09:00' }] }),
    });
    assert.equal(r.status, 400);
    const fields = r.body.details.map((d) => d.field);
    for (const f of ['email', 'phone', 'consultationFee', 'experience', 'specialization', 'registration.number', 'availability']) assert.ok(fields.includes(f), `missing error for ${f}: ${fields}`);
  });

  it('does not leave an orphaned User when the Doctor insert fails', async () => {
    const before = await User.countDocuments();
    const orig = Doctor.prototype.save;
    Doctor.prototype.save = async function boom() { throw new Error('simulated failure'); };
    try {
      const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ email: 'orphan@example.com', registration: { number: 'MMC-ORPH-1', council: 'Maharashtra Medical Council', state: 'Maharashtra' } }) });
      assert.equal(r.status, 500);
      assert.ok(!JSON.stringify(r.body).includes('simulated'), 'no internals leaked');
    } finally { Doctor.prototype.save = orig; }
    assert.equal(await User.countDocuments(), before);
    assert.equal(await User.countDocuments({ email: 'orphan@example.com' }), 0);
  });

  it('supports search + filters', async () => {
    const q = await call('GET', '/api/admin/doctors?q=meera.nair%40example', { token: S.tHA });
    assert.equal(q.body.data.items.length, 1);
    const none = await call('GET', '/api/admin/doctors?q=zzzz', { token: S.tHA });
    assert.equal(none.body.data.items.length, 0);
    const dep = await call('GET', `/api/admin/doctors?departmentId=${S.deptA2._id}`, { token: S.tHA });
    assert.equal(dep.body.data.items.length, 0);
    const spec = await call('GET', '/api/admin/doctors?specialization=Cardiologist', { token: S.tHA });
    assert.ok(spec.body.data.items.length >= 1);
    const st = await call('GET', '/api/admin/doctors?status=INACTIVE&verification=PENDING&account=PENDING_VERIFICATION', { token: S.tHA });
    assert.ok(st.body.data.items.length >= 1);
  });
});

/* ============================================================ invitation + activation */
describe('Invitation and activation', () => {
  it('blocks activation until the invitation is accepted', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}/status`, { token: S.tHA, body: { status: 'ACTIVE' } });
    assert.equal(r.status, 409);
  });

  it('login is refused before the invitation is accepted', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'meera.nair@example.com', password: 'anything-1234' } });
    assert.ok([401, 403].includes(r.status));
  });

  it('rejects malformed/unknown tokens and weak passwords', async () => {
    assert.equal((await call('GET', '/api/auth/invitations/abc')).status, 400);
    assert.equal((await call('GET', `/api/auth/invitations/${'a'.repeat(64)}`)).status, 400);
    const token = S.invite.inviteUrl.split('token=')[1];
    assert.equal((await call('POST', '/api/auth/accept-invitation', { body: { token, password: 'short' } })).status, 400);
  });

  it('accepts the invitation once, then the doctor can sign in', async () => {
    const token = S.invite.inviteUrl.split('token=')[1];
    const info = await call('GET', `/api/auth/invitations/${token}`);
    assert.equal(info.status, 200);
    assert.equal(info.body.data.email, 'meera.nair@example.com');
    const ok = await call('POST', '/api/auth/accept-invitation', { body: { token, password: 'DoctorPass#1' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await call('POST', '/api/auth/accept-invitation', { body: { token, password: 'DoctorPass#2' } })).status, 400, 'single use');
    const login = await call('POST', '/api/auth/login', { body: { email: 'meera.nair@example.com', password: 'DoctorPass#1' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    S.tDoc = login.body.data.accessToken;
    const u = await User.findOne({ email: 'meera.nair@example.com' });
    assert.equal(u.emailVerified, true);
    assert.ok(u.lastLoginAt);
  });

  it('an expired invitation is refused, and a new one can be issued', async () => {
    const pend = await Doctor.findById(S.pendingDocId);
    await User.updateOne({ _id: pend.userId }, { $set: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    const r = await call('POST', `/api/admin/doctors/${S.pendingDocId}/invite`, { token: S.tHA });
    assert.equal(r.status, 200);
    const info = await call('GET', `/api/auth/invitations/${r.body.data.invitation.inviteUrl.split('token=')[1]}`);
    assert.equal(info.status, 200);
  });

  it('doctor can read their own profile via /doctors/me even while inactive', async () => {
    const r = await call('GET', '/api/doctors/me', { token: S.tDoc });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.userId.email, 'meera.nair@example.com');
  });
});

/* ============================================================ TEST B — edit */
describe('B. Edit doctor', () => {
  it('updates fee, specialization and schedule, persisted in MongoDB', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { consultationFee: 1100, specialization: 'Internal Medicine', additionalSpecializations: ['Cardiologist'], consultationRoom: 'Room 14' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const doc = await Doctor.findById(S.docId);
    assert.equal(doc.consultationFee, 1100);
    assert.equal(doc.specialization, 'Internal Medicine');
    assert.deepEqual([...doc.additionalSpecializations], ['Cardiologist']);
    assert.equal(r.body.data.consultationFee, 1100);
    // restore
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { specialization: 'Cardiologist', additionalSpecializations: ['Internal Medicine'] } });
  });

  it('does not let the payload move the hospital or change the login email', async () => {
    const a = await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { hospitalId: String(S.hospB._id) } });
    assert.equal(a.status, 403);
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { email: 'hijack@example.com', role: 'SUPER_ADMIN' } });
    const doc = await Doctor.findById(S.docId);
    const u = await User.findById(doc.userId);
    assert.equal(u.email, 'meera.nair@example.com');
    assert.equal(u.role, 'DOCTOR');
  });

  it('rejects a specialization that does not match the category', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { specialization: 'Dentist' } });
    assert.equal(r.status, 400);
  });

  it('rejects overlapping schedule windows', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { availability: [{ dayOfWeek: 2, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 2, startTime: '11:00', endTime: '14:00' }] } });
    assert.equal(r.status, 400);
  });
});

/* ============================================================ TEST C — isolation */
describe('C. Hospital isolation', () => {
  it('Hospital Admin B cannot read, edit, change status, verify or fetch documents of Hospital A', async () => {
    const checks = [
      ['GET', `/api/admin/doctors/${S.docId}`],
      ['PATCH', `/api/admin/doctors/${S.docId}`, { consultationFee: 1 }],
      ['PATCH', `/api/admin/doctors/${S.docId}/status`, { status: 'INACTIVE' }],
      ['PATCH', `/api/admin/doctors/${S.docId}/verification`, { decision: 'REJECTED', notes: 'x' }],
      ['POST', `/api/admin/doctors/${S.docId}/invite`],
      ['GET', `/api/admin/doctors/${S.docId}/documents/${new mongoose.Types.ObjectId()}`],
    ];
    for (const [m, p, body] of checks) {
      const r = await call(m, p, { token: S.tHB, body });
      assert.equal(r.status, 403, `${m} ${p} → ${r.status}`);
    }
    assert.equal((await Doctor.findById(S.docId)).consultationFee, 1100);
  });

  it('a hospital admin with no hospital assigned gets nothing', async () => {
    assert.equal((await call('GET', '/api/admin/doctors', { token: S.tHN })).status, 403);
    assert.equal((await call('POST', '/api/admin/doctors', { token: S.tHN, body: doctorPayload({ email: 'n1@example.com' }) })).status, 403);
    const dash = await call('GET', '/api/admin/appointments', { token: S.tHN });
    assert.equal(dash.body.data.items.length, 0, 'previously an unscoped query');
  });

  it('patients, doctors and anonymous callers cannot use the admin APIs', async () => {
    for (const t of [S.tPat, S.tDoc]) {
      assert.equal((await call('GET', '/api/admin/doctors', { token: t })).status, 403);
      assert.equal((await call('POST', '/api/admin/doctors', { token: t, body: doctorPayload() })).status, 403);
    }
    assert.equal((await call('GET', '/api/admin/doctors')).status, 401);
  });
});

/* ============================================================ documents + verification */
describe('Documents and the verification workflow', () => {
  it('entering a registration number does not verify; verification needs documents', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}/verification`, { token: S.tHA, body: { decision: 'VERIFIED' } });
    assert.equal(r.status, 400);
    assert.equal((await Doctor.findById(S.docId)).verification.status, 'PENDING');
  });

  it('rejection requires a reason', async () => {
    assert.equal((await call('PATCH', `/api/admin/doctors/${S.docId}/verification`, { token: S.tHA, body: { decision: 'REJECTED' } })).status, 400);
  });

  it('validates file type, content and ownership on upload', async () => {
    const bad = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('x.txt', 'REGISTRATION_CERTIFICATE', 'hello', 'text/plain') });
    assert.equal(bad.status, 400);
    const fake = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('x.pdf', 'REGISTRATION_CERTIFICATE', 'MZ-not-a-pdf', 'application/pdf') });
    assert.equal(fake.status, 400, 'signature must match the declared type');
    const wrongType = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('x.pdf', 'BOGUS') });
    assert.equal(wrongType.status, 400);
    const other = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHB, form: pdfForm() });
    assert.equal(other.status, 403);
  });

  it('stores documents privately and serves them only through the authorised route', async () => {
    const a = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('reg.pdf', 'REGISTRATION_CERTIFICATE') });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.ok(!('storageKey' in a.body.data));
    S.regDocId = a.body.data._id;
    const b = await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('mbbs.pdf', 'QUALIFICATION_CERTIFICATE') });
    assert.equal(b.status, 201);

    const detail = await call('GET', `/api/admin/doctors/${S.docId}`, { token: S.tHA });
    assert.equal(detail.body.data.documents.length, 2);
    assert.ok(detail.body.data.documents.every((d) => !('storageKey' in d)));

    const dl = await call('GET', `/api/admin/doctors/${S.docId}/documents/${S.regDocId}`, { token: S.tHA });
    assert.equal(dl.status, 200);
    assert.ok(String(dl.body).startsWith('%PDF-'));
    assert.equal((await call('GET', `/api/admin/doctors/${S.docId}/documents/${S.regDocId}`, { token: S.tHB })).status, 403);
    assert.equal((await call('GET', `/api/admin/doctors/${S.docId}/documents/${S.regDocId}`, { token: S.tPat })).status, 403);
    assert.equal((await call('GET', `/api/admin/doctors/${S.docId}/documents/${S.regDocId}`)).status, 401);
    // not reachable via the public static route either
    assert.equal((await call('GET', '/uploads/doctor-documents/anything.pdf')).status, 404);
  });

  it('records a verification decision with who/when, then admin can activate', async () => {
    const v = await call('PATCH', `/api/admin/doctors/${S.docId}/verification`, { token: S.tHA, body: { decision: 'VERIFIED', notes: 'Checked certificate against the council register' } });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    const doc = await Doctor.findById(S.docId).select('+verification.verifiedBy +verification.method +verification.notes');
    assert.equal(doc.verification.status, 'VERIFIED');
    assert.equal(String(doc.verification.verifiedBy), String(S.haA._id));
    assert.ok(doc.verification.verifiedAt);
    assert.equal(doc.verification.method, 'MANUAL_DOCUMENT_REVIEW');
    const act = await call('PATCH', `/api/admin/doctors/${S.docId}/status`, { token: S.tHA, body: { status: 'ACTIVE' } });
    assert.equal(act.status, 200, JSON.stringify(act.body));
    assert.equal((await Doctor.findById(S.docId)).status, 'ACTIVE');
  });

  it('editing credentials resets a previous verification', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { registration: { number: 'MMC-2011-99999' } } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await Doctor.findById(S.docId)).verification.status, 'PENDING');
    await call('PATCH', `/api/admin/doctors/${S.docId}/verification`, { token: S.tHA, body: { decision: 'VERIFIED' } });
    assert.equal((await Doctor.findById(S.docId)).verification.status, 'VERIFIED');
  });

  it('deleting a required document revokes verification', async () => {
    const d = await Doctor.findById(S.docId).select('+documents');
    const qual = d.documents.find((x) => x.type === 'QUALIFICATION_CERTIFICATE');
    const r = await call('DELETE', `/api/admin/doctors/${S.docId}/documents/${qual._id}`, { token: S.tHA });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.verificationReset, true);
    assert.equal((await Doctor.findById(S.docId)).verification.status, 'PENDING');
    // re-upload + re-verify for later tests
    await call('POST', `/api/admin/doctors/${S.docId}/documents`, { token: S.tHA, form: pdfForm('mbbs2.pdf', 'QUALIFICATION_CERTIFICATE') });
    const v = await call('PATCH', `/api/admin/doctors/${S.docId}/verification`, { token: S.tHA, body: { decision: 'VERIFIED' } });
    assert.equal(v.status, 200);
  });
});

/* ============================================================ TEST F — patient integration */
describe('F. Patient directory and booking', () => {
  const monday = nextMonday();

  it('lists the eligible doctor with public info only', async () => {
    const r = await call('GET', '/api/doctors');
    assert.equal(r.status, 200);
    const d = r.body.data.items.find((x) => x._id === S.docId);
    assert.ok(d, 'verified + active doctor is listed');
    assert.equal(d.specialization, 'Cardiologist');
    assert.equal(d.departmentId.name, 'Cardiology');
    assert.equal(d.consultationFee, 1100);
    assert.deepEqual(d.consultationModes.sort(), ['IN_PERSON', 'VIDEO']);
    const text = JSON.stringify(r.body);
    for (const leak of ['meera.nair@example.com', '98765', 'MMC-2011', 'documents', 'storageKey', 'passwordHash', 'Maharashtra Medical Council']) assert.ok(!text.includes(leak), `public listing leaks ${leak}`);
  });

  it('does not list unverified or inactive doctors (and hides their profile)', async () => {
    const r = await call('GET', '/api/doctors');
    assert.ok(!r.body.data.items.some((x) => x._id === S.pendingDocId));
    assert.equal((await call('GET', `/api/doctors/${S.pendingDocId}`)).status, 404);
    assert.equal((await call('GET', `/api/doctors/${S.pendingDocId}`, { token: S.tPat })).status, 404);
    assert.equal((await call('GET', `/api/doctors/${S.pendingDocId}`, { token: S.tHA })).status, 200, 'its own hospital admin can');
  });

  it('computes availability excluding the break, and honours leave dates', async () => {
    const r = await call('GET', `/api/doctors/${S.docId}/availability?date=${monday}`);
    const times = r.body.data.slots.map((s) => s.startTime);
    assert.equal(times[0], '09:00');
    assert.ok(!times.includes('11:00'), 'break slot removed');
    assert.equal(times.length, 11);
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { leaveDates: [monday] } });
    const leave = await call('GET', `/api/doctors/${S.docId}/availability?date=${monday}`);
    assert.equal(leave.body.data.slots.length, 0);
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { leaveDates: [] } });
  });

  it('books a valid slot (end time derived on the server) and stores it correctly', async () => {
    const r = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:00', endTime: '23:59', consultationType: 'VIDEO' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const a = await Appointment.findById(r.body.data._id);
    assert.equal(a.endTime, '09:20', 'client-supplied endTime is ignored');
    assert.equal(String(a.hospitalId), String(S.hospA._id));
    assert.equal(String(a.departmentId), String(S.deptA1._id));
    assert.equal(String(a.patientId), String(S.patient._id));
    S.apptId = String(a._id);
  });

  it('prevents double booking', async () => {
    const r = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:00', endTime: '09:20', consultationType: 'VIDEO' } });
    assert.equal(r.status, 409);
    assert.equal(await Appointment.countDocuments({ doctorId: S.docId, startTime: '09:00', date: new Date(monday) }), 1);
  });

  it('prevents concurrent double booking of the same slot', async (ctx) => {
    // This guarantee comes from the unique partial index on Appointment. Some Mongo-compatible
    // servers (e.g. FerretDB) do not enforce partial unique indexes, so probe first.
    const probe = { patientId: S.patient._id, doctorId: S.docId, hospitalId: S.hospA._id, departmentId: S.deptA1._id, date: new Date('2031-01-06'), startTime: '08:00', endTime: '08:20' };
    await Appointment.create(probe);
    const enforced = await Appointment.create({ ...probe }).then(() => false, (e) => e.code === 11000);
    await Appointment.deleteMany({ date: new Date('2031-01-06') });
    if (!enforced) return ctx.skip('database does not enforce partial unique indexes (needs real MongoDB)');
    const reqs = await Promise.all([1, 2, 3].map(() => call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:20', endTime: '09:40', consultationType: 'VIDEO' } })));
    const created = reqs.filter((r) => r.status === 201).length;
    assert.equal(created, 1, `statuses: ${reqs.map((r) => r.status)}`);
    assert.equal(await Appointment.countDocuments({ doctorId: S.docId, startTime: '09:20', date: new Date(monday) }), 1);
  });

  it('rejects times off the schedule grid, inside the break, on non-working days and in the past', async () => {
    const bodyOf = (o) => ({ doctorId: S.docId, date: monday, startTime: '09:00', endTime: '09:20', consultationType: 'VIDEO', ...o });
    for (const o of [{ startTime: '09:05' }, { startTime: '11:00' }, { startTime: '14:00' }, { date: nextMonday().replace(/-\d\d$/, '-') + '01', startTime: '09:00' }]) {
      const r = await call('POST', '/api/appointments', { token: S.tPat, body: bodyOf(o) });
      assert.ok([400].includes(r.status), `${JSON.stringify(o)} → ${r.status}`);
    }
    const past = await call('POST', '/api/appointments', { token: S.tPat, body: bodyOf({ date: '2020-01-06' }) });
    assert.equal(past.status, 400);
  });

  it('rejects a consultation mode the doctor does not offer', async () => {
    const r = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:40', endTime: '10:00', consultationType: 'AUDIO' } });
    assert.equal(r.status, 400);
  });

  it('enforces the maximum appointments per day', async () => {
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { maxAppointmentsPerDay: 1 } });
    const r = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:40', endTime: '10:00', consultationType: 'VIDEO' } });
    assert.equal(r.status, 409);
    const av = await call('GET', `/api/doctors/${S.docId}/availability?date=${monday}`);
    assert.ok(av.body.data.slots.every((s) => !s.available), 'day is full');
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { maxAppointmentsPerDay: 10 } });
  });

  it('booking can be switched off', async () => {
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { bookingEnabled: false } });
    assert.ok(!(await call('GET', '/api/doctors')).body.data.items.some((x) => x._id === S.docId));
    const r = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:40', endTime: '10:00', consultationType: 'VIDEO' } });
    assert.equal(r.status, 400);
    await call('PATCH', `/api/admin/doctors/${S.docId}`, { token: S.tHA, body: { bookingEnabled: true } });
  });

  it('the public appointment payload does not expose sensitive doctor data', async () => {
    const r = await call('GET', `/api/appointments/${S.apptId}`, { token: S.tPat });
    assert.equal(r.status, 200);
    const text = JSON.stringify(r.body);
    for (const leak of ['MMC-2011', 'documents', 'storageKey', 'Maharashtra Medical Council']) assert.ok(!text.includes(leak), `leaks ${leak}`);
  });
});

/* ============================================================ TEST D — deactivation */
describe('D. Doctor deactivation', () => {
  it('locks the doctor out and blocks new bookings, keeping existing appointments', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}/status`, { token: S.tHA, body: { status: 'INACTIVE' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.data.affectedUpcomingAppointments >= 1);
    const doc = await Doctor.findById(S.docId);
    assert.equal(doc.status, 'INACTIVE');
    assert.equal((await User.findById(doc.userId)).status, 'SUSPENDED');

    // existing token no longer works on protected doctor endpoints
    assert.equal((await call('GET', '/api/doctors/me', { token: S.tDoc })).status, 401);
    assert.equal((await call('PATCH', '/api/doctors/me/availability', { token: S.tDoc, body: { availability: [] } })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'meera.nair@example.com', password: 'DoctorPass#1' } })).status, 403);

    // no new bookings, not listed, no slots
    const monday = nextMonday(2);
    const book = await call('POST', '/api/appointments', { token: S.tPat, body: { doctorId: S.docId, date: monday, startTime: '09:00', endTime: '09:20', consultationType: 'VIDEO' } });
    assert.equal(book.status, 400);
    assert.ok(!(await call('GET', '/api/doctors')).body.data.items.some((x) => x._id === S.docId));
    const av = await call('GET', `/api/doctors/${S.docId}/availability?date=${monday}`);
    assert.equal(av.body.data.slots.length, 0);
    assert.equal(av.body.data.bookable, false);

    // existing appointment still exists
    assert.ok(await Appointment.findById(S.apptId));
  });

  it('can be re-activated', async () => {
    const r = await call('PATCH', `/api/admin/doctors/${S.docId}/status`, { token: S.tHA, body: { status: 'ACTIVE' } });
    assert.equal(r.status, 200);
    const login = await call('POST', '/api/auth/login', { body: { email: 'meera.nair@example.com', password: 'DoctorPass#1' } });
    assert.equal(login.status, 200);
    assert.ok((await call('GET', '/api/doctors')).body.data.items.some((x) => x._id === S.docId));
  });

  it('invalid status values are rejected', async () => {
    assert.equal((await call('PATCH', `/api/admin/doctors/${S.docId}/status`, { token: S.tHA, body: { status: 'DELETED' } })).status, 400);
  });
});

/* ============================================================ TEST E — super admin users */
describe('E. Super Admin user management', () => {
  before(async () => {
    S.victim = await mkUser({ name: 'Victim Patient', email: 'victim@t.com', role: 'PATIENT', phone: '+91 90000 00001' });
    S.victimPatient = await Patient.create({ userId: S.victim._id, dateOfBirth: new Date('1990-01-01'), address: { city: 'Secret City' }, allergies: ['Penicillin'], emergencyContact: { name: 'Kin', phone: '123' } });
    S.victimAppt = await Appointment.create({ patientId: S.victimPatient._id, doctorId: S.docId, hospitalId: S.hospA._id, departmentId: S.deptA1._id, date: new Date(nextMonday(3)), startTime: '09:00', endTime: '09:20' });
    S.tVictim = tokenFor(S.victim);
  });

  it('lists with search, role/status filters and pagination', async () => {
    const all = await call('GET', '/api/admin/users?limit=3&page=1', { token: S.tSA });
    assert.equal(all.status, 200);
    assert.equal(all.body.data.items.length, 3);
    assert.ok(all.body.data.pagination.totalPages >= 2);
    assert.ok(all.body.data.items.every((u) => !('passwordHash' in u) && !('tokenVersion' in u)));
    const role = await call('GET', '/api/admin/users?role=HOSPITAL_ADMIN', { token: S.tSA });
    assert.ok(role.body.data.items.every((u) => u.role === 'HOSPITAL_ADMIN'));
    const q = await call('GET', '/api/admin/users?q=victim', { token: S.tSA });
    assert.equal(q.body.data.items.length, 1);
    const st = await call('GET', '/api/admin/users?status=PENDING_VERIFICATION', { token: S.tSA });
    assert.ok(st.body.data.items.every((u) => u.status === 'PENDING_VERIFICATION'));
  });

  it('is closed to every other role and to anonymous callers', async () => {
    for (const [t, expected] of [[S.tHA, 403], [S.tPat, 403], [S.tDoc, 403], [undefined, 401]]) {
      for (const [m, p, b] of [['GET', '/api/admin/users'], ['GET', `/api/admin/users/${S.victim._id}`], ['PATCH', `/api/admin/users/${S.victim._id}`, { role: 'SUPER_ADMIN' }], ['PATCH', `/api/admin/users/${S.victim._id}/status`, { status: 'SUSPENDED' }], ['DELETE', `/api/admin/users/${S.victim._id}`, { confirmEmail: 'victim@t.com' }], ['GET', '/api/admin/audit-logs']]) {
        const r = await call(m, p, { token: t, body: b });
        assert.equal(r.status, expected, `${m} ${p} as ${t ? 'role' : 'anon'} → ${r.status}`);
      }
    }
    assert.equal((await User.findById(S.victim._id)).role, 'PATIENT');
  });

  it('views a user with linked profile info', async () => {
    const r = await call('GET', `/api/admin/users/${S.victim._id}`, { token: S.tSA });
    assert.equal(r.body.data.email, 'victim@t.com');
    assert.equal(r.body.data.hasPatientProfile, true);
    const d = await call('GET', `/api/admin/users/${(await Doctor.findById(S.docId)).userId}`, { token: S.tSA });
    assert.equal(d.body.data.doctorProfile.specialization, 'Cardiologist');
  });

  it('edits name/phone with validation and blocks duplicate emails', async () => {
    const ok = await call('PATCH', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { name: 'Victim Renamed', phone: '+91 91111 11111' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await User.findById(S.victim._id)).name, 'Victim Renamed');
    const bad = await call('PATCH', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { name: 'x', phone: 'abc', email: 'pat1@t.com' } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.details.map((d) => d.field).sort(), ['email', 'name', 'phone']);
  });

  it('restricts role changes (no patient/doctor flips, no self change, no unknown roles)', async () => {
    const toSA = await call('PATCH', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { role: 'SUPER_ADMIN' } });
    assert.equal(toSA.status, 400);
    assert.equal((await User.findById(S.victim._id)).role, 'PATIENT');
    assert.equal((await call('PATCH', `/api/admin/users/${S.sa1._id}`, { token: S.tSA, body: { role: 'PHARMACY_ADMIN' } })).status, 400);
    assert.equal((await call('PATCH', `/api/admin/users/${S.haB._id}`, { token: S.tSA, body: { role: 'GOD' } })).status, 400);
    const staff = await call('PATCH', `/api/admin/users/${S.haB._id}`, { token: S.tSA, body: { role: 'PHARMACY_ADMIN' } });
    assert.equal(staff.status, 200, JSON.stringify(staff.body));
    const u = await User.findById(S.haB._id);
    assert.equal(u.role, 'PHARMACY_ADMIN');
    assert.equal(u.hospitalId, null);
    assert.equal((await call('GET', '/api/admin/doctors', { token: S.tHB })).status, 403, 'old HA token loses admin rights immediately');
    // back to hospital admin requires a hospital
    assert.equal((await call('PATCH', `/api/admin/users/${S.haB._id}`, { token: S.tSA, body: { role: 'HOSPITAL_ADMIN' } })).status, 400);
    const back = await call('PATCH', `/api/admin/users/${S.haB._id}`, { token: S.tSA, body: { role: 'HOSPITAL_ADMIN', hospitalId: String(S.hospB._id) } });
    assert.equal(back.status, 200, JSON.stringify(back.body));
  });

  it('prevents deactivating or deleting your own account', async () => {
    assert.equal((await call('PATCH', `/api/admin/users/${S.sa1._id}/status`, { token: S.tSA, body: { status: 'SUSPENDED' } })).status, 400);
    assert.equal((await call('DELETE', `/api/admin/users/${S.sa1._id}`, { token: S.tSA, body: { confirmEmail: 'sa1@t.com' } })).status, 400);
    assert.equal((await User.findById(S.sa1._id)).status, 'ACTIVE');
  });

  it('protects the last active Super Admin', async () => {
    // actor is a different (non-super-admin) user id, which is only reachable through the service layer
    await assert.rejects(userAdminService.setStatus(S.haA, String(S.sa1._id), 'SUSPENDED'), /last active Super Admin/);
    await assert.rejects(userAdminService.deleteUser(S.haA, String(S.sa1._id), { confirmEmail: 'sa1@t.com' }), /last active Super Admin/);
    await assert.rejects(userAdminService.updateUser(S.haA, String(S.sa1._id), { role: 'HOSPITAL_ADMIN', hospitalId: String(S.hospA._id) }), /last active Super Admin/);
    // with a second super admin the first CAN be deactivated by it — and then the survivor is protected
    const sa2 = await mkUser({ name: 'SA Two', email: 'sa2@t.com', role: 'SUPER_ADMIN' });
    const t2 = tokenFor(sa2);
    const r = await call('PATCH', `/api/admin/users/${S.sa1._id}/status`, { token: t2, body: { status: 'SUSPENDED' } });
    assert.equal(r.status, 200);
    assert.equal((await call('GET', '/api/admin/users', { token: S.tSA })).status, 401, 'suspended super admin is locked out');
    await assert.rejects(userAdminService.setStatus(S.haA, String(sa2._id), 'SUSPENDED'), /last active Super Admin/);
    assert.equal((await call('PATCH', `/api/admin/users/${S.sa1._id}/status`, { token: t2, body: { status: 'ACTIVE' } })).status, 200);
    await User.deleteOne({ _id: sa2._id });
  });

  it('deactivates and reactivates a user; a suspended user cannot reach protected endpoints', async () => {
    assert.equal((await call('GET', '/api/auth/me', { token: S.tVictim })).status, 200);
    const off = await call('PATCH', `/api/admin/users/${S.victim._id}/status`, { token: S.tSA, body: { status: 'SUSPENDED' } });
    assert.equal(off.status, 200);
    assert.equal((await User.findById(S.victim._id)).status, 'SUSPENDED');
    assert.equal((await call('GET', '/api/auth/me', { token: S.tVictim })).status, 401);
    assert.equal((await call('GET', '/api/patients/me', { token: S.tVictim })).status, 401);
    const on = await call('PATCH', `/api/admin/users/${S.victim._id}/status`, { token: S.tSA, body: { status: 'ACTIVE' } });
    assert.equal(on.status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: S.tVictim })).status, 200);
    assert.equal((await call('PATCH', `/api/admin/users/${S.victim._id}/status`, { token: S.tSA, body: { status: 'DELETED' } })).status, 400);
  });

  it('suspending a doctor user also stops new bookings', async () => {
    const du = (await Doctor.findById(S.docId)).userId;
    const r = await call('PATCH', `/api/admin/users/${du}/status`, { token: S.tSA, body: { status: 'SUSPENDED' } });
    assert.equal(r.status, 200);
    assert.equal((await Doctor.findById(S.docId)).status, 'INACTIVE');
    assert.equal((await call('PATCH', `/api/admin/users/${du}/status`, { token: S.tSA, body: { status: 'ACTIVE' } })).status, 200);
    assert.equal((await Doctor.findById(S.docId)).status, 'ACTIVE');
  });

  it('cannot activate a user who has not accepted their invitation', async () => {
    const pend = await Doctor.findById(S.pendingDocId);
    assert.equal((await call('PATCH', `/api/admin/users/${pend.userId}/status`, { token: S.tSA, body: { status: 'ACTIVE' } })).status, 409);
  });

  it('delete requires typed confirmation, then anonymises and retains history', async () => {
    assert.equal((await call('DELETE', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: {} })).status, 400);
    assert.equal((await call('DELETE', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { confirmEmail: 'wrong@t.com' } })).status, 400);
    assert.equal((await User.findById(S.victim._id)).status, 'ACTIVE');

    const r = await call('DELETE', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { confirmEmail: 'VICTIM@t.com' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.retained.appointments, 1);
    const u = await User.findById(S.victim._id).select('+passwordHash');
    assert.equal(u.status, 'DELETED');
    assert.equal(u.name, 'Deleted User');
    assert.ok(u.email.endsWith('@deleted.invalid'));
    assert.ok(!u.phone);
    assert.ok(u.deletedAt);
    // clinical/appointment history is preserved, identity removed
    const p = await Patient.findById(S.victimPatient._id);
    assert.ok(p, 'patient record kept');
    assert.ok(!p.dateOfBirth && !p.address?.city && !p.emergencyContact?.name);
    assert.deepEqual([...p.allergies], ['Penicillin']);
    assert.ok(await Appointment.findById(S.victimAppt._id), 'appointment kept');
    // cannot log in / reuse token / be re-deleted; the email is free again
    assert.equal((await call('GET', '/api/auth/me', { token: S.tVictim })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'victim@t.com', password: 'Password@123' } })).status, 401);
    assert.equal((await call('DELETE', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { confirmEmail: u.email } })).status, 409);
    assert.equal((await call('PATCH', `/api/admin/users/${S.victim._id}`, { token: S.tSA, body: { name: 'Zombie' } })).status, 409);
    const reg = await call('POST', '/api/auth/register', { body: { name: 'New Victim', email: 'victim@t.com', password: 'Password@123' } });
    assert.equal(reg.status, 201);
    // hidden from the default list, visible under the Deleted filter
    const def = await call('GET', '/api/admin/users?q=Deleted', { token: S.tSA });
    assert.equal(def.body.data.items.length, 0);
    const del = await call('GET', '/api/admin/users?status=DELETED', { token: S.tSA });
    assert.equal(del.body.data.items.length, 1);
  });

  it('writes audit logs without secrets', async () => {
    const r = await call('GET', '/api/admin/audit-logs?limit=100', { token: S.tSA });
    assert.equal(r.status, 200);
    const actions = new Set(r.body.data.items.map((l) => l.action));
    for (const a of ['DOCTOR_CREATED', 'DOCTOR_UPDATED', 'DOCTOR_STATUS_CHANGED', 'DOCTOR_VERIFICATION_RECORDED', 'DOCTOR_DOCUMENT_UPLOADED', 'DOCTOR_DOCUMENT_VIEWED', 'USER_UPDATED', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED', 'USER_DELETED']) assert.ok(actions.has(a), `missing audit action ${a}`);
    const text = JSON.stringify(r.body);
    assert.ok(!/passwordHash|inviteUrl|storageKey|DoctorPass|Password@123|accessToken|[a-f0-9]{64}/.test(text), 'audit log contains a secret');
    assert.ok(r.body.data.items.every((l) => l.actorRole));
  });

  it('hospital admins cannot create Super Admins or escalate privileges', async () => {
    const r = await call('POST', '/api/admin/doctors', { token: S.tHA, body: doctorPayload({ email: 'esc@example.com', role: 'SUPER_ADMIN', registration: { number: 'MMC-ESC-1', council: 'Maharashtra Medical Council', state: 'Maharashtra' } }) });
    assert.equal(r.status, 201);
    assert.equal((await User.findOne({ email: 'esc@example.com' })).role, 'DOCTOR');
    assert.equal((await call('PATCH', `/api/admin/users/${S.haA._id}`, { token: S.tHA, body: { role: 'SUPER_ADMIN' } })).status, 403);
    assert.equal((await User.findById(S.haA._id)).role, 'HOSPITAL_ADMIN');
  });
});

/* ============================================================ misc existing behaviour */
describe('Registration', () => {
  it('self-registration can only create patients', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Sneaky', email: 'sneaky@t.com', password: 'Password@123', role: 'DOCTOR' } });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.user.role, 'PATIENT');
    const sa = await call('POST', '/api/auth/register', { body: { name: 'Sneaky2', email: 'sneaky2@t.com', password: 'Password@123', role: 'SUPER_ADMIN' } });
    assert.equal(sa.body.data.user.role, 'PATIENT');
  });
});

describe('Public options', () => {
  it('serves the 45 specializations and categories used by the form', async () => {
    const r = await call('GET', '/api/doctors/meta/options');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.specializations.length, 45);
    assert.ok(r.body.data.professionalCategories.length >= 4);
  });
});

describe('Form context', () => {
  it('scopes the hospital/department choices to the caller', async () => {
    const a = await call('GET', '/api/admin/doctor-form-context', { token: S.tHA });
    assert.equal(a.body.data.hospitals.length, 1);
    assert.equal(String(a.body.data.hospitals[0]._id), String(S.hospA._id));
    assert.ok(a.body.data.departments.every((d) => ['Cardiology', 'General Medicine', 'Dermatology'].includes(d.name)));
    const sa = await call('GET', `/api/admin/doctor-form-context?hospitalId=${S.hospB._id}`, { token: S.tSA });
    assert.equal(sa.body.data.hospitals.length, 2);
    assert.equal(sa.body.data.departments.length, 1);
    assert.equal((await call('GET', '/api/admin/doctor-form-context', { token: S.tPat })).status, 403);
  });
});

describe('Departments', () => {
  it('a hospital admin can add a department only to their own hospital', async () => {
    const ok = await call('POST', '/api/admin/departments', { token: S.tHA, body: { name: 'Dermatology' } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(String(ok.body.data.hospitalId), String(S.hospA._id));
    assert.equal((await call('POST', '/api/admin/departments', { token: S.tHA, body: { name: 'dermatology' } })).status, 409);
    const cross = await call('POST', '/api/admin/departments', { token: S.tHA, body: { name: 'Sneaky Dept', hospitalId: String(S.hospB._id) } });
    assert.equal(cross.status, 403);
  });
});
