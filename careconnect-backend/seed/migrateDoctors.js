/* eslint-disable no-console */
// One-off, NON-DESTRUCTIVE migration for databases that already contain doctors created before
// the verification workflow existed. Run once:   node seed/migrateDoctors.js [--grandfather]
//
// Without flags it only REPORTS how many existing doctors have no recorded verification.
// With --grandfather it marks them VERIFIED (method MIGRATION) so they stay bookable under
// DOCTOR_VERIFICATION_POLICY=required. Only do that if you already trust those doctors; the
// alternative is to leave them PENDING and review each through the admin UI.
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const Doctor = require('../models/Doctor');

(async () => {
  await mongoose.connect(env.mongoUri);
  const grandfather = process.argv.includes('--grandfather');
  const legacy = { 'verification.status': { $exists: false } };
  const count = await Doctor.countDocuments(legacy);
  console.log(`${count} doctor(s) have no verification record yet.`);
  if (count && grandfather) {
    const res = await Doctor.updateMany(legacy, {
      $set: {
        'verification.status': 'VERIFIED',
        'verification.verifiedAt': new Date(),
        'verification.method': 'MIGRATION',
        'verification.notes': 'Grandfathered by migration — not reviewed through the document workflow',
        professionalCategory: 'MEDICAL_DOCTOR',
      },
    });
    console.log(`Marked ${res.modifiedCount} doctor(s) as VERIFIED (grandfathered).`);
  } else if (count) {
    console.log('Re-run with --grandfather to keep them bookable, or review each one in the admin UI.');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
