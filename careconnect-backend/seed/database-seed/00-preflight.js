/* eslint-disable no-console */
// 00-preflight.js - READ ONLY. Shows what exists and what the seed would do. Writes nothing.
const mongoose = require('mongoose');
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Department = require('../../models/Department');
const Hospital = require('../../models/Hospital');
const { DEMO_EMAIL_DOMAIN, DEPARTMENTS, DOCTORS, normalizeName, departmentIndex, run } = require('./demo-data');

run(async () => {
  console.log('\nDOCTOR_VERIFICATION_POLICY =', (process.env.DOCTOR_VERIFICATION_POLICY || 'required (default)'));

  const hospitals = await Hospital.find({}).sort({ createdAt: 1 });
  console.log(`\n== Hospitals (${hospitals.length}) ==`);
  hospitals.forEach((h) => console.log(`  ${h._id}  ${h.name}  [${h.status}]`));
  const active = hospitals.filter((h) => h.status === 'ACTIVE');
  if (active.length !== 1 && !process.env.HOSPITAL_ID) {
    console.log(`\n!! ${active.length} active hospitals. The seed scripts will refuse to run until you set HOSPITAL_ID.`);
    return;
  }
  const hospital = process.env.HOSPITAL_ID ? active.find((h) => String(h._id) === process.env.HOSPITAL_ID.trim()) : active[0];
  if (!hospital) { console.log('!! HOSPITAL_ID is not an ACTIVE hospital.'); return; }
  console.log(`\nSelected hospital: ${hospital.name} (${hospital._id})`);

  // ---- departments
  const { map, all } = await departmentIndex(hospital._id);
  console.log(`\n== Departments in this hospital (${all.length}) ==`);
  const docCounts = await Doctor.aggregate([{ $match: { hospitalId: hospital._id } }, { $group: { _id: '$departmentId', n: { $sum: 1 } } }]);
  const countBy = new Map(docCounts.map((c) => [String(c._id), c.n]));
  all.forEach((d) => console.log(`  ${d._id}  ${d.name}  [${d.status}]  doctors: ${countBy.get(String(d._id)) || 0}`));
  const seen = new Map();
  all.forEach((d) => { const k = normalizeName(d.name); seen.set(k, (seen.get(k) || 0) + 1); });
  [...seen].filter(([, n]) => n > 1).forEach(([k]) => console.log(`  !! duplicate department name (normalized): ${k}`));
  const missingDepts = DEPARTMENTS.filter((d) => !map.has(normalizeName(d.name)));
  console.log(`\n  Departments the seed would CREATE (${missingDepts.length}): ${missingDepts.map((d) => d.name).join(', ') || 'none'}`);
  const inactive = DEPARTMENTS.filter((d) => map.get(normalizeName(d.name)) && map.get(normalizeName(d.name)).status !== 'ACTIVE');
  inactive.forEach((d) => console.log(`  !! "${d.name}" exists but is INACTIVE - doctors will NOT be attached to it (not modified).`));

  // ---- doctors
  const doctors = await Doctor.find({ hospitalId: hospital._id }).populate('userId', 'name email role status');
  console.log(`\n== Existing doctors in this hospital (${doctors.length}) ==`);
  doctors.slice(0, 60).forEach((d) => console.log(`  ${d.userId ? d.userId.email : '(NO USER)'}  | ${d.specialization || '-'} | verification: ${d.verification && d.verification.status}`));
  if (doctors.length > 60) console.log(`  ... and ${doctors.length - 60} more`);

  // ---- demo users
  const demoUsers = await User.find({ email: new RegExp(DEMO_EMAIL_DOMAIN.replace('.', '\\.') + '$', 'i') }).select('email role');
  console.log(`\n== Existing users on ${DEMO_EMAIL_DOMAIN} (${demoUsers.length}) ==`);
  const existingEmails = new Set(demoUsers.map((u) => u.email));
  const toCreate = DOCTORS.filter((d) => !existingEmails.has(d.email));
  console.log(`  Demo doctor users the seed would CREATE: ${toCreate.length} of ${DOCTORS.length}`);
  const legacy = await User.find({ role: 'DOCTOR', email: /@careconnect\.example$/i }).select('email');
  if (legacy.length) console.log(`  note: ${legacy.length} DOCTOR users already exist on @careconnect.example (an earlier demo set / seed.js). They are left untouched.`);

  // ---- relationship checks
  console.log('\n== Relationship checks (all doctors, whole database) ==');
  const every = await Doctor.find({}).select('userId departmentId hospitalId');
  const userIds = new Set((await User.find({ _id: { $in: every.map((d) => d.userId) } }).select('_id role')).filter((u) => u.role === 'DOCTOR').map((u) => String(u._id)));
  const deptDocs = await Department.find({ _id: { $in: every.map((d) => d.departmentId) } }).select('hospitalId');
  const deptHosp = new Map(deptDocs.map((d) => [String(d._id), String(d.hospitalId)]));
  const hospIds = new Set((await Hospital.find({}).select('_id')).map((h) => String(h._id)));
  let bad = 0;
  every.forEach((d) => {
    if (!userIds.has(String(d.userId))) { bad++; console.log(`  !! doctor ${d._id}: userId missing or not a DOCTOR user`); }
    if (!deptHosp.has(String(d.departmentId))) { bad++; console.log(`  !! doctor ${d._id}: department missing`); }
    else if (deptHosp.get(String(d.departmentId)) !== String(d.hospitalId)) { bad++; console.log(`  !! doctor ${d._id}: department belongs to a different hospital`); }
    if (!hospIds.has(String(d.hospitalId))) { bad++; console.log(`  !! doctor ${d._id}: hospital missing`); }
  });
  console.log(bad ? `  ${bad} problem(s) found (existing data - NOT modified).` : '  none found.');

  // ---- dashboard scoping
  const admins = await User.find({ role: 'HOSPITAL_ADMIN' }).select('email hospitalId');
  console.log(`\n== Hospital admins (${admins.length}) - the dashboard only counts doctors of the admin's own hospital ==`);
  admins.forEach((a) => console.log(`  ${a.email}  hospitalId: ${a.hospitalId || 'NONE'} ${String(a.hospitalId) === String(hospital._id) ? '(matches)' : '  !! does NOT match selected hospital'}`));
  console.log('\nPreflight finished. Nothing was written.');
});
