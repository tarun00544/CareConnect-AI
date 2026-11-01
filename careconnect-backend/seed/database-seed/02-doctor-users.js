/* eslint-disable no-console */
// 02-doctor-users.js - creates the demo DOCTOR login accounts (2 per department = 50).
// Existing users are never modified. Password is read from DEMO_DOCTOR_PASSWORD and stored ONLY as a
// bcrypt hash (bcryptjs, cost 12 - identical to services/authService.js).
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { DOCTORS, DRY_RUN, selectHospital, run } = require('./demo-data');

const SALT_ROUNDS = 12;

run(async () => {
  const password = process.env.DEMO_DOCTOR_PASSWORD;
  if (!password || password.length < 8) throw new Error('Set DEMO_DOCTOR_PASSWORD (at least 8 characters) before running. It is hashed, never stored.');
  const hospital = await selectHospital();
  console.log(`Hospital: ${hospital.name} (${hospital._id})`);

  let created = 0; let skipped = 0;
  for (const d of DOCTORS) {
    const existing = await User.findOne({ email: d.email }).select('email role hospitalId');
    if (existing) {
      skipped++;
      const note = existing.role !== 'DOCTOR' ? '  !! exists with role ' + existing.role : '';
      console.log(`  exists  ${d.email}${note}`);
      continue;
    }
    if (DRY_RUN) { console.log(`  would create  ${d.email}`); created++; continue; }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      name: d.name, email: d.email, passwordHash, role: 'DOCTOR', status: 'ACTIVE',
      hospitalId: hospital._id, emailVerified: false, // fictional address - never verified
    });
    created++;
    console.log(`  CREATED ${d.email}`);
  }
  console.log(`\nDoctor users: ${DRY_RUN ? 'would create' : 'created'} ${created}, already existed ${skipped}, target ${DOCTORS.length}.`);
});
