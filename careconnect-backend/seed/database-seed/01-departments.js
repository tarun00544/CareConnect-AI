/* eslint-disable no-console */
// 01-departments.js - creates MISSING departments only (match: hospitalId + normalized name).
// Existing departments are reused and never modified. Use --dry-run to preview.
const Department = require('../../models/Department');
const Hospital = require('../../models/Hospital');
const { DEPARTMENTS, DRY_RUN, normalizeName, selectHospital, departmentIndex, run } = require('./demo-data');

run(async () => {
  const hospital = await selectHospital();
  console.log(`Hospital: ${hospital.name} (${hospital._id})`);
  const { map } = await departmentIndex(hospital._id);

  let created = 0; let reused = 0;
  const newIds = [];
  for (const d of DEPARTMENTS) {
    const existing = map.get(normalizeName(d.name));
    if (existing) {
      reused++;
      console.log(`  reuse   ${d.name}  (${existing._id})${existing.status !== 'ACTIVE' ? '  [INACTIVE - left as is]' : ''}`);
      continue;
    }
    if (DRY_RUN) { console.log(`  would create  ${d.name}`); created++; continue; }
    try {
      const doc = await Department.create({ name: d.name, description: d.description, hospitalId: hospital._id, status: 'ACTIVE' });
      newIds.push(doc._id); created++;
      console.log(`  CREATED ${d.name}  (${doc._id})`);
    } catch (err) {
      if (err.code === 11000) { reused++; console.log(`  reuse   ${d.name}  (created concurrently)`); } else throw err;
    }
  }
  // Same convention as the app (doctorAdminService): keep Hospital.departments in sync via $addToSet.
  if (!DRY_RUN && newIds.length) await Hospital.updateOne({ _id: hospital._id }, { $addToSet: { departments: { $each: newIds } } });
  console.log(`\nDepartments: ${DRY_RUN ? 'would create' : 'created'} ${created}, reused ${reused}, target ${DEPARTMENTS.length}.`);
});
