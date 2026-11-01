/* eslint-disable no-console */
// 04-verify.js - READ ONLY. Prints a PASS/FAIL report and sets a non-zero exit code on failure.
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const Department = require('../../models/Department');
const { DEMO_EMAIL_DOMAIN, DEPARTMENTS, DOCTORS, normalizeName, selectHospital, departmentIndex, run } = require('./demo-data');

run(async () => {
  const hospital = await selectHospital();
  console.log(`Hospital: ${hospital.name} (${hospital._id})\n`);
  const results = [];
  const check = (label, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  - ' + detail : ''}`); };

  const { map, all } = await departmentIndex(hospital._id);
  const missing = DEPARTMENTS.filter((d) => { const x = map.get(normalizeName(d.name)); return !x || x.status !== 'ACTIVE'; });
  check(`Departments: ${all.length} in hospital; all ${DEPARTMENTS.length} target departments present & ACTIVE`, missing.length === 0, missing.map((d) => d.name).join(', '));

  const demoRe = new RegExp(DEMO_EMAIL_DOMAIN.replace('.', '\\.') + '$', 'i');
  const demoUsers = await User.find({ email: demoRe }).select('email role');
  check(`Demo doctor user accounts: ${demoUsers.length} (target ${DOCTORS.length})`, demoUsers.length === DOCTORS.length && demoUsers.every((u) => u.role === 'DOCTOR'));
  const emailCount = new Map();
  demoUsers.forEach((u) => emailCount.set(u.email.toLowerCase(), (emailCount.get(u.email.toLowerCase()) || 0) + 1));
  check('No duplicate demo emails', [...emailCount.values()].every((n) => n === 1));

  const demoDoctors = await Doctor.find({ userId: { $in: demoUsers.map((u) => u._id) } }).select('+verification.notes');
  check(`Demo doctor profiles: ${demoDoctors.length} (target ${DOCTORS.length})`, demoDoctors.length === DOCTORS.length);
  check('No demo doctor is marked VERIFIED', demoDoctors.every((d) => d.verification.status !== 'VERIFIED'));
  const dup = await Doctor.aggregate([{ $group: { _id: '$userId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
  check('No user has more than one doctor profile', dup.length === 0);

  console.log('\nDemo doctors per department:');
  const perDept = new Map();
  demoDoctors.forEach((d) => perDept.set(String(d.departmentId), (perDept.get(String(d.departmentId)) || 0) + 1));
  let perDeptOk = true;
  DEPARTMENTS.forEach((d) => {
    const dep = map.get(normalizeName(d.name)); const n = dep ? perDept.get(String(dep._id)) || 0 : 0;
    if (n !== 2) perDeptOk = false;
    console.log(`  ${n === 2 ? 'ok ' : '!! '} ${d.name}: ${n}`);
  });
  check('Exactly 2 demo doctors in every target department', perDeptOk);

  // orphan / relationship checks for EVERY doctor of this hospital (existing ones included)
  const doctors = await Doctor.find({ hospitalId: hospital._id }).select('userId departmentId hospitalId');
  const users = new Map((await User.find({ _id: { $in: doctors.map((d) => d.userId) } }).select('role hospitalId')).map((u) => [String(u._id), u]));
  const depts = new Map((await Department.find({ _id: { $in: doctors.map((d) => d.departmentId) } }).select('hospitalId')).map((x) => [String(x._id), x]));
  const orphans = doctors.filter((d) => {
    const u = users.get(String(d.userId)); const x = depts.get(String(d.departmentId));
    return !u || u.role !== 'DOCTOR' || !x || String(x.hospitalId) !== String(hospital._id);
  });
  check(`No orphaned doctor references (checked ${doctors.length} doctors in this hospital)`, orphans.length === 0, orphans.map((d) => d._id).join(', '));

  console.log(`\nDoctors the Hospital Admin dashboard will show for this hospital: ${doctors.length}`);
  const admins = await User.find({ role: 'HOSPITAL_ADMIN' }).select('email hospitalId');
  const wrong = admins.filter((a) => String(a.hospitalId) !== String(hospital._id));
  check('Hospital admins are assigned to this hospital (otherwise their dashboard shows 0)', wrong.length === 0, wrong.map((a) => a.email).join(', '));

  const ok = results.every(Boolean);
  console.log(`\n${ok ? 'SUCCESS: seed data is complete and consistent.' : 'FAILURE: see the FAIL lines above.'}`);
  if (!ok) process.exitCode = 1;
});
