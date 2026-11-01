/* eslint-disable no-console */
// 03-doctor-profiles.js - creates the Doctor documents for the demo users from script 02.
// Links ONLY to existing User / Department / Hospital records. Demo doctors are saved with
// verification.status = PENDING (no real verification took place) and carry no registration number.
const User = require('../../models/User');
const Doctor = require('../../models/Doctor');
const { validateAvailability } = require('../../services/scheduleService');
const { DOCTORS, DRY_RUN, normalizeName, selectHospital, departmentIndex, run } = require('./demo-data');

run(async () => {
  const hospital = await selectHospital();
  console.log(`Hospital: ${hospital.name} (${hospital._id})`);
  const { map } = await departmentIndex(hospital._id);

  let created = 0; let skipped = 0; let failed = 0;
  for (const d of DOCTORS) {
    const user = await User.findOne({ email: d.email }).select('role hospitalId');
    if (!user) { failed++; console.log(`  SKIP ${d.email}: user not found (run 02 first)`); continue; }
    if (user.role !== 'DOCTOR') { failed++; console.log(`  SKIP ${d.email}: user role is ${user.role}`); continue; }
    if (String(user.hospitalId) !== String(hospital._id)) { failed++; console.log(`  SKIP ${d.email}: user belongs to another hospital`); continue; }
    if (await Doctor.exists({ userId: user._id })) { skipped++; console.log(`  exists  ${d.email}`); continue; }

    const dept = map.get(normalizeName(d.department));
    if (!dept || dept.status !== 'ACTIVE') { failed++; console.log(`  SKIP ${d.email}: ACTIVE department "${d.department}" not found (run 01 first)`); continue; }
    const problems = validateAvailability(d.availability);
    if (problems.length) { failed++; console.log(`  SKIP ${d.email}: ${problems.join('; ')}`); continue; }
    if (DRY_RUN) { console.log(`  would create  ${d.email}  -> ${dept.name}`); created++; continue; }

    await Doctor.create({
      userId: user._id, departmentId: dept._id, hospitalId: hospital._id,
      qualification: d.qualification, specialization: d.specialization, experience: d.experience,
      consultationFee: d.consultationFee, followUpFee: d.followUpFee, bio: d.bio,
      availability: d.availability, status: 'ACTIVE', gender: d.gender,
      professionalCategory: d.professionalCategory, additionalSpecializations: [], languages: d.languages,
      verification: { status: 'PENDING', notes: 'DEMO - fictional profile. Not a real licensed professional and not verified.' },
      consultationRoom: d.consultationRoom, consultationModes: d.consultationModes,
      appointmentDurationMinutes: d.appointmentDurationMinutes,
      emergencyAvailable: d.emergencyAvailable, onlineConsultationAvailable: d.onlineConsultationAvailable,
      bookingEnabled: true, leaveDates: [],
    });
    created++;
    console.log(`  CREATED ${d.email}  -> ${dept.name}`);
  }
  console.log(`\nDoctor profiles: ${DRY_RUN ? 'would create' : 'created'} ${created}, already existed ${skipped}, skipped/failed ${failed}, target ${DOCTORS.length}.`);
});
